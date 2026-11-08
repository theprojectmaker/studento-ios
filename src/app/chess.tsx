/** Multiplayer chess between two Beam users. The game lives in Firestore (games/{id}) and updates live. */
import { Chess, type Square } from 'chess.js';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamLockScreen } from '@/components/beam-lock-screen';
import { BeamAvatar, Glyph, useBeam } from '@/components/beam-ui';
import { tap } from '@/components/ui';
import { playMove, resign, watchGame, type Game } from '@/lib/beam-extra';
import { useBeamUnlocked } from '@/lib/beam-lock';
import { goBack } from '@/lib/beam-nav';

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const FILES = 'abcdefgh';

export default function ChessScreen() {
  return useBeamUnlocked() ? <ChessGame /> : <BeamLockScreen />;
}

function ChessGame() {
  const c = useBeam();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { g } = useLocalSearchParams<{ g: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [myUid, setMyUid] = useState('');
  const [sel, setSel] = useState<Square | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!g) return;
    return watchGame(String(g), (x, uid) => {
      setGame(x);
      setMyUid(uid);
      setLoaded(true);
    });
  }, [g]);

  const chess = useMemo(() => (game ? new Chess(game.fen) : null), [game]);
  const black = !!game && game.black === myUid;
  const myTurn = !!game && !!chess && game.status === 'playing' && (chess.turn() === 'w' ? game.white : game.black) === myUid;
  const targets = useMemo(() => (chess && sel ? new Set(chess.moves({ square: sel, verbose: true }).map((m) => m.to)) : new Set<string>()), [chess, sel]);
  const last = useMemo(() => {
    if (!game?.moves.length) return null;
    const h = new Chess();
    let m = null;
    for (const san of game.moves) m = h.move(san);
    return m ? [m.from, m.to] : null;
  }, [game]);

  const other = game ? game.members.find((m) => m !== myUid) ?? '' : '';
  const otherName = game?.names[other] ?? '';
  const size = Math.min(width - 24, height - insets.top - insets.bottom - 240, 560);
  const cell = size / 8;

  const press = async (sq: Square) => {
    if (!chess || !myTurn) return;
    const piece = chess.get(sq);
    if (sel && targets.has(sq)) {
      const from = sel;
      setSel(null);
      tap();
      try {
        await playMove(String(g), from, sq);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't move.");
      }
      return;
    }
    setSel(piece && piece.color === chess.turn() ? (sel === sq ? null : sq) : null);
  };

  const giveUp = () => {
    const go = () => void resign(String(g)).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't resign."));
    if (Platform.OS === 'web') {
      if (window.confirm('Resign this game?')) go();
      return;
    }
    Alert.alert('Resign this game?', `${otherName} wins.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resign', style: 'destructive', onPress: go },
    ]);
  };

  let status = '';
  if (game && chess) {
    if (game.status === 'checkmate') status = game.winner === myUid ? 'Checkmate. You win!' : `Checkmate. ${otherName} wins.`;
    else if (game.status === 'resigned') status = game.winner === myUid ? `${otherName} resigned. You win!` : 'You resigned.';
    else if (game.status === 'draw') status = 'Draw.';
    else status = `${myTurn ? 'Your move' : `${otherName}'s move`}${chess.inCheck() ? ' · Check!' : ''}`;
  }

  const rows = black ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const cols = black ? [...FILES].reverse() : [...FILES];

  return (
    <View style={{ flex: 1, backgroundColor: c.chatBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} hitSlop={10} style={{ width: 70 }}>
          <Glyph.Back color={c.blue} size={26} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: c.text, fontSize: 17, fontWeight: '700' }}>Chess</Text>
        <View style={{ width: 70, alignItems: 'flex-end' }}>
          {game?.status === 'playing' ? (
            <Pressable onPress={giveUp} hitSlop={8}>
              <Text style={{ color: c.red, fontSize: 15 }}>Resign</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {!loaded ? (
        <Text style={{ color: c.text3, textAlign: 'center', marginTop: 40 }}>Loading game…</Text>
      ) : !game || !chess ? (
        <Text style={{ color: c.text3, textAlign: 'center', marginTop: 40 }}>{"This game isn't available."}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: size }}>
            <BeamAvatar name={otherName || '?'} size={30} />
            <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>{otherName}</Text>
            <Text style={{ color: c.text3, fontSize: 13 }}>{black ? 'White' : 'Black'}</Text>
          </View>

          <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden' }}>
            {rows.map((r) => (
              <View key={r} style={{ flexDirection: 'row' }}>
                {cols.map((f) => {
                  const sq = `${f}${r}` as Square;
                  const p = chess.get(sq);
                  const dark = (FILES.indexOf(f) + r) % 2 === 1;
                  const isSel = sel === sq;
                  const isLast = !!last && last.includes(sq);
                  const isTarget = targets.has(sq);
                  const kingInCheck = p?.type === 'k' && p.color === chess.turn() && chess.inCheck();
                  return (
                    <Pressable key={sq} onPress={() => void press(sq)} style={{ width: cell, height: cell, backgroundColor: kingInCheck ? '#e5484d' : isSel ? '#f6e05e' : isLast ? (dark ? '#bfae4a' : '#e6d97a') : dark ? '#7b9e62' : '#ebecd0', alignItems: 'center', justifyContent: 'center' }}>
                      {p ? <Text style={{ fontSize: cell * 0.72, lineHeight: cell * 0.9, color: p.color === 'w' ? '#ffffff' : '#111111', textShadowColor: p.color === 'w' ? '#000' : 'transparent', textShadowRadius: 2 }}>{GLYPH[p.type]}</Text> : null}
                      {isTarget ? <View style={{ position: 'absolute', width: p ? cell * 0.9 : cell * 0.3, height: p ? cell * 0.9 : cell * 0.3, borderRadius: cell, backgroundColor: p ? 'transparent' : 'rgba(0,0,0,0.22)', borderWidth: p ? 4 : 0, borderColor: 'rgba(0,0,0,0.25)' }} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <Text style={{ color: game.status === 'playing' ? c.text : c.blue, fontSize: 17, fontWeight: '700' }}>{status}</Text>
          {err ? <Text style={{ color: c.red, fontSize: 13 }}>{err}</Text> : null}
          {game.moves.length ? (
            <Text style={{ color: c.text3, fontSize: 13, width: size, lineHeight: 19 }}>
              {game.moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join('  ')}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
