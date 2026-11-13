/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization */
/** Chess Buddy's board (tests/chess/components/Board.tsx), copied as-is. It reads refs while
 * rendering, so it opts out of the React Compiler ("use no memo") and those lint rules. */
'use no memo';
import { Chess } from 'chess.js';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { boardPrefs, colors, fonts, shape, themed , CheckIcon, CloseIcon, webNoSelect } from './theme';
import { Piece } from './Piece';

const MARK = { last: 'rgba(255, 255, 51, 0.48)', selected: 'rgba(255, 255, 51, 0.72)', check: 'rgba(235, 60, 60, 0.75)', dot: 'rgba(20, 30, 20, 0.22)' };

export interface BoardMove {
  from: string;
  to: string;
  promotion?: string;
}
interface Props {
  fen: string;
  size: number;
  orientation?: 'w' | 'b';
  movable?: 'w' | 'b' | null;
  onMove?: (move: BoardMove) => void;
  lastMove?: [string, string] | null;
  arrow?: { from: string; to: string; color?: string } | null;
  marks?: Record<string, string>;
  badge?: { square: string; kind: 'good' | 'bad'; color?: string; text?: string } | null;
  hideCoords?: boolean;
  onSquareTap?: (square: string) => void;
}

interface Placed {
  id: number;
  type: string;
  color: 'w' | 'b';
  square: string;
}

const FILES = 'abcdefgh';
export const BOARD_CHROME = 22; // the most a board's base can add around the squares
const DRAG_LIFT = 0.3;

function placeFromFen(fen: string): Omit<Placed, 'id'>[] {
  const out: Omit<Placed, 'id'>[] = [];
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        f += Number(ch);
      } else {
        const lower = ch.toLowerCase();
        out.push({ type: lower, color: ch === lower ? 'b' : 'w', square: FILES[f] + (8 - r) });
        f++;
      }
    }
  });
  return out;
}

const dist = (a: string, b: string) =>
  Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(Number(a[1]) - Number(b[1]));

// Keeps each piece's identity across positions, so it slides instead of popping into place.
function reconcile(prev: Placed[], next: Omit<Placed, 'id'>[], nextId: { current: number }): Placed[] {
  const free = [...prev];
  const out: (Placed | null)[] = next.map((p) => {
    const i = free.findIndex((o) => o.square === p.square && o.type === p.type && o.color === p.color);
    if (i < 0) return null;
    return free.splice(i, 1)[0];
  });
  next.forEach((p, idx) => {
    if (out[idx]) return;
    let bestI = -1;
    let bestD = 99;
    free.forEach((o, i) => {
      if (o.type === p.type && o.color === p.color && dist(o.square, p.square) < bestD) {
        bestI = i;
        bestD = dist(o.square, p.square);
      }
    });
    if (bestI >= 0) {
      const [o] = free.splice(bestI, 1);
      out[idx] = { ...o, square: p.square };
    } else {
      out[idx] = { ...p, id: nextId.current++ };
    }
  });
  return out as Placed[];
}

const BoardPiece = memo(function BoardPiece({
  piece, cell, x, y, skipAnim, dragging, dragPos, lifted,
}: {
  piece: Placed; cell: number; x: number; y: number; skipAnim: boolean; dragging: boolean; dragPos: Animated.ValueXY; lifted: boolean;
}) {
  const pos = useRef(new Animated.ValueXY({ x, y })).current;
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (skipAnim) {
      pos.setValue({ x, y });
    } else {
      Animated.timing(pos, { toValue: { x, y }, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }
  }, [x, y, skipAnim, pos]);
  useEffect(() => {
    Animated.spring(lift, { toValue: lifted ? 1 : 0, friction: 5, tension: 220, useNativeDriver: false }).start();
  }, [lifted, lift]);
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, dragging ? 1.4 : 1.1] });
  const translate = dragging ? dragPos.getTranslateTransform() : pos.getTranslateTransform();
  return (
    <Animated.View pointerEvents="none" style={[styles.piece, { width: cell, height: cell, zIndex: dragging ? 50 : lifted ? 20 : 2, transform: [...translate, { scale }] }]}>
      <Piece type={piece.type} color={piece.color} size={cell} />
    </Animated.View>
  );
});

export function Board({ fen, size, orientation = 'w', movable = null, onMove, lastMove, arrow, marks, badge, hideCoords, onSquareTap }: Props) {
  const cell = size / 8;
  const flipped = orientation === 'b';
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const dragPos = useRef(new Animated.ValueXY()).current;
  const nextId = useRef(1);
  const placedRef = useRef<Placed[]>([]);
  const snapIds = useRef(new Set<number>());
  const placedFen = useRef<string | null>(null);

  if (placedFen.current !== fen) {
    placedRef.current = reconcile(placedRef.current, placeFromFen(fen), nextId);
    placedFen.current = fen;
  }
  const placed = placedRef.current;

  const { legal, checkSquare, turn } = useMemo(() => {
    const c = new Chess(fen);
    const map: Record<string, { to: string; promotion?: string }[]> = {};
    for (const m of c.moves({ verbose: true })) (map[m.from] ??= []).push({ to: m.to, promotion: m.promotion });
    let check: string | null = null;
    if (c.isCheck()) {
      const king = placeFromFen(fen).find((p) => p.type === 'k' && p.color === c.turn());
      check = king?.square ?? null;
    }
    return { legal: map, checkSquare: check, turn: c.turn() };
  }, [fen]);

  useEffect(() => {
    setSelected(null);
    setPromo(null);
    setDragId(null);
    setHover(null);
  }, [fen]);

  const canMove = movable != null && movable === turn;
  const targets = selected && canMove ? (legal[selected] ?? []) : [];
  const targetSet = useMemo(() => new Set(targets.map((t) => t.to)), [targets]);

  const toXY = (sq: string) => {
    const f = sq.charCodeAt(0) - 97;
    const r = Number(sq[1]) - 1;
    return { x: (flipped ? 7 - f : f) * cell, y: (flipped ? r : 7 - r) * cell };
  };
  const fromXY = (x: number, y: number) => {
    const col = Math.max(0, Math.min(7, Math.floor(x / cell)));
    const row = Math.max(0, Math.min(7, Math.floor(y / cell)));
    return FILES[flipped ? 7 - col : col] + (flipped ? row + 1 : 8 - row);
  };

  const submit = (from: string, to: string, viaDrag: boolean) => {
    const options = (legal[from] ?? []).filter((m) => m.to === to);
    if (options.length === 0) return false;
    if (options.some((m) => m.promotion)) {
      if (boardPrefs.autoQueen) {
        onMove?.({ from, to, promotion: 'q' });
        return true;
      }
      setPromo({ from, to });
      return true;
    }
    if (viaDrag) {
      const moved = placed.find((p) => p.square === from);
      if (moved) snapIds.current.add(moved.id);
    }
    onMove?.({ from, to });
    return true;
  };

  const live = useRef({ selected, canMove, placed, legal, cell, promo, submit, fromXY, setSelected, setDragId, setHover, movable: movable as string | null });
  live.current = { selected, canMove, placed, legal, cell, promo, submit, fromXY, setSelected, setDragId, setHover, movable };
  const tapRef = useRef(onSquareTap);
  tapRef.current = onSquareTap;
  const gesture = useRef({ start: { x: 0, y: 0 }, square: '', id: -1, dragging: false, wasSelected: false, tapMoved: false });

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const s = live.current;
        const g = gesture.current;
        g.start = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
        g.dragging = false;
        g.id = -1;
        g.tapMoved = false;
        if (s.promo) return;
        const sq = s.fromXY(g.start.x, g.start.y);
        if (tapRef.current) {
          g.tapMoved = true;
          tapRef.current(sq);
          return;
        }
        g.square = sq;
        g.wasSelected = s.selected === sq;
        if (!s.canMove) return;
        if (s.selected && s.selected !== sq && s.submit(s.selected, sq, false)) {
          g.tapMoved = true;
          return;
        }
        const piece = s.placed.find((p) => p.square === sq);
        if (piece && piece.color === s.movable && s.legal[sq]) {
          g.id = piece.id;
          s.setSelected(sq);
        } else {
          s.setSelected(null);
        }
      },
      onPanResponderMove: (_, state) => {
        const s = live.current;
        const g = gesture.current;
        if (g.id < 0 || g.tapMoved) return;
        if (!g.dragging && Math.abs(state.dx) + Math.abs(state.dy) < 6) return;
        const x = g.start.x + state.dx;
        const y = g.start.y + state.dy;
        if (!g.dragging) {
          g.dragging = true;
          s.setDragId(g.id);
        }
        // Drawn slightly above the fingertip so it stays visible; the drop uses the same offset.
        dragPos.setValue({ x: x - s.cell / 2, y: y - s.cell * (0.5 + DRAG_LIFT) });
        s.setHover(s.fromXY(x, y - s.cell * DRAG_LIFT));
      },
      onPanResponderRelease: (_, state) => {
        const s = live.current;
        const g = gesture.current;
        if (g.tapMoved) return;
        if (g.dragging) {
          const dropped = s.fromXY(g.start.x + state.dx, g.start.y + state.dy - s.cell * DRAG_LIFT);
          s.setDragId(null);
          s.setHover(null);
          if (dropped === g.square || !s.submit(g.square, dropped, true)) return;
          s.setSelected(null);
        } else if (g.wasSelected) {
          s.setSelected(null);
        }
      },
      onPanResponderTerminate: () => {
        live.current.setDragId(null);
        live.current.setHover(null);
      },
    }),
  ).current;

  const showCoords = !hideCoords && boardPrefs.showCoords;
  const style = boardPrefs.board;
  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = FILES[flipped ? 7 - col : col] + (flipped ? row + 1 : 8 - row);
      const dark = (row + col) % 2 === 1;
      let mark: string | null = null;
      if (lastMove && (lastMove[0] === sq || lastMove[1] === sq)) mark = MARK.last;
      if (marks?.[sq]) mark = marks[sq];
      if (selected === sq) mark = MARK.selected;
      const coordColor = dark ? boardPrefs.board.light : boardPrefs.board.dark;
      squares.push(
        <View key={sq} style={{ width: cell, height: cell, backgroundColor: dark ? boardPrefs.board.dark : boardPrefs.board.light }}>
          {mark && <View style={[StyleSheet.absoluteFill, { backgroundColor: mark }]} />}
          {checkSquare === sq && <View style={[StyleSheet.absoluteFill, styles.check]} />}
          {hover === sq && <View style={[StyleSheet.absoluteFill, styles.hover]} />}
          {showCoords && col === 0 && <Text style={[styles.coord, styles.coordRank, { color: coordColor, fontSize: cell * 0.2 }]}>{sq[1]}</Text>}
          {showCoords && row === 7 && <Text style={[styles.coord, styles.coordFile, { color: coordColor, fontSize: cell * 0.2 }]}>{sq[0]}</Text>}
        </View>,
      );
    }
  }

  const occupied = useMemo(() => new Set(placed.map((p) => p.square)), [placed]);

  return (
    <View style={[styles.plinth, style.plinth ? { padding: 7, backgroundColor: style.plinth, borderBottomWidth: 8, borderBottomColor: style.plinthLip, borderRadius: shape.boardRadius + 8 } : null]}>
      <View style={[styles.board, { width: size, height: size, borderRadius: shape.boardRadius }, webNoSelect]}>
        <View style={styles.grid}>{squares}</View>

        {boardPrefs.showHints && [...targetSet].map((sq) => {
          const { x, y } = toXY(sq);
          return (
            <View key={sq} pointerEvents="none" style={[styles.hintCell, { width: cell, height: cell, transform: [{ translateX: x }, { translateY: y }] }]}>
              {occupied.has(sq) ? (
                <View style={{ width: cell * 0.94, height: cell * 0.94, borderRadius: cell, borderWidth: cell * 0.09, borderColor: MARK.dot }} />
              ) : (
                <View style={{ width: cell * 0.3, height: cell * 0.3, borderRadius: cell, backgroundColor: MARK.dot }} />
              )}
            </View>
          );
        })}

        {placed.map((p) => {
          const { x, y } = toXY(p.square);
          const skip = snapIds.current.has(p.id);
          if (skip) setTimeout(() => snapIds.current.delete(p.id), 60);
          return (
            <BoardPiece key={p.id} piece={p} cell={cell} x={x} y={y} skipAnim={skip} dragging={dragId === p.id} dragPos={dragPos} lifted={dragId === p.id || (selected === p.square && canMove)} />
          );
        })}

        {arrow && <Arrow from={toXY(arrow.from)} to={toXY(arrow.to)} cell={cell} size={size} color={arrow.color ?? colors.sky} />}

        {badge && <SquareBadge key={badge.square + (badge.text ?? badge.kind)} badge={badge} cell={cell} size={size} at={toXY(badge.square)} />}

        <View {...responder.panHandlers} accessibilityLabel="Chess board" style={[StyleSheet.absoluteFill, styles.touch, webNoSelect]} />

        {promo && (
          <View style={styles.promoWrap}>
            <View style={styles.promoCard}>
              {(['q', 'r', 'b', 'n'] as const).map((type) => (
                <Pressable
                  key={type}
                  accessibilityLabel={`Promote to ${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[type]}`}
                  style={styles.promoTile}
                  onPress={() => {
                    const move = { from: promo.from, to: promo.to, promotion: type };
                    setPromo(null);
                    onMove?.(move);
                  }}
                >
                  <Piece type={type} color={turn} size={cell * 1.05} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function SquareBadge({ badge, cell, size, at }: { badge: NonNullable<Props['badge']>; cell: number; size: number; at: { x: number; y: number } }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 180, useNativeDriver: false }).start();
  }, [pop]);
  const d = cell * 0.5;
  return (
    <Animated.View pointerEvents="none" style={[styles.badge, { left: Math.min(at.x + cell * 0.6, size - d - 1), top: Math.max(at.y - cell * 0.16, 1), width: d, height: d, borderRadius: cell, backgroundColor: badge.color ?? (badge.kind === 'good' ? colors.leaf : colors.coral), transform: [{ scale: pop }] }]}>
      {badge.text ? (
        <Text style={{ color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: cell * 0.27, lineHeight: cell * 0.32 }}>{badge.text}</Text>
      ) : badge.kind === 'good' ? (
        <CheckIcon size={cell * 0.32} />
      ) : (
        <CloseIcon size={cell * 0.3} color="#FFFFFF" />
      )}
    </Animated.View>
  );
}

function Arrow({ from, to, cell, size, color }: { from: { x: number; y: number }; to: { x: number; y: number }; cell: number; size: number; color: string }) {
  const x1 = from.x + cell / 2;
  const y1 = from.y + cell / 2;
  const x2 = to.x + cell / 2;
  const y2 = to.y + cell / 2;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = cell * 0.42;
  const tipBack = { x: x2 - Math.cos(angle) * head * 0.8, y: y2 - Math.sin(angle) * head * 0.8 };
  const left = { x: x2 - Math.cos(angle - 0.55) * head, y: y2 - Math.sin(angle - 0.55) * head };
  const right = { x: x2 - Math.cos(angle + 0.55) * head, y: y2 - Math.sin(angle + 0.55) * head };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={size} height={size}>
        <Line x1={x1} y1={y1} x2={tipBack.x} y2={tipBack.y} stroke={color} strokeOpacity={0.85} strokeWidth={cell * 0.17} strokeLinecap="round" />
        <Path d={`M${x2} ${y2}L${left.x} ${left.y}L${right.x} ${right.y}Z`} fill={color} fillOpacity={0.9} />
      </Svg>
    </View>
  );
}

const styles = themed(() => ({
  plinth: { alignSelf: 'center' },
  board: { overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' },
  piece: { position: 'absolute', left: 0, top: 0 },
  hintCell: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  check: { backgroundColor: MARK.check, borderRadius: 999 },
  hover: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  coord: { position: 'absolute', fontFamily: fonts.bold },
  coordRank: { left: 3, top: 1 },
  coordFile: { right: 3, bottom: 0 },
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 60, borderWidth: 2, borderColor: '#FFFFFF' },
  touch: { zIndex: 70 },
  promoWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,30,40,0.35)' },
  promoCard: { flexDirection: 'row', gap: 6, backgroundColor: colors.page, padding: 8, borderRadius: 18, borderBottomWidth: 6, borderBottomColor: colors.lineLip },
  promoTile: { backgroundColor: colors.wash, borderRadius: 12 },
}));
