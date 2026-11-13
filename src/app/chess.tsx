/** Multiplayer chess between two Beam users, on Chess Buddy's board and pieces. The game lives in Firestore (games/{id}) and updates live. */
import { Chess } from 'chess.js';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BeamLockScreen } from '@/components/beam-lock-screen';
import { Board, BOARD_CHROME, type BoardMove } from '@/components/chessbuddy/Board';
import { Piece } from '@/components/chessbuddy/Piece';
import { colors as BUDDY } from '@/components/chessbuddy/theme';
import { BeamAvatar, Glyph, useBeam } from '@/components/beam-ui';
import { tap } from '@/components/ui';
import { playMove, resign, watchGame, type Game } from '@/lib/beam-extra';
import { useBeamUnlocked } from '@/lib/beam-lock';
import { goBack } from '@/lib/beam-nav';


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
  const myColor: 'w' | 'b' = !!game && game.black === myUid ? 'b' : 'w';
  const myTurn = !!game && !!chess && game.status === 'playing' && chess.turn() === myColor;
  const last = useMemo((): [string, string] | null => {
    if (!game?.moves.length) return null;
    const h = new Chess();
    let m = null;
    for (const san of game.moves) m = h.move(san);
    return m ? [m.from, m.to] : null;
  }, [game]);

  const other = game ? (game.members.find((m) => m !== myUid) ?? '') : '';
  const otherName = game?.names[other] ?? '';
  const meName = game?.names[myUid] ?? 'You';
  const size = Math.min(width - 24, height - insets.top - insets.bottom - 300, 560) - BOARD_CHROME;

  const move = async (m: BoardMove) => {
    tap();
    try {
      await playMove(String(g), m.from, m.to);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't move.");
    }
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
  let statusTone: 'turn' | 'wait' | 'win' | 'lose' | 'draw' = 'wait';
  if (game && chess) {
    if (game.status === 'checkmate') {
      status = game.winner === myUid ? 'Checkmate! You win' : `Checkmate. ${otherName} wins`;
      statusTone = game.winner === myUid ? 'win' : 'lose';
    } else if (game.status === 'resigned') {
      status = game.winner === myUid ? `${otherName} resigned. You win` : 'You resigned';
      statusTone = game.winner === myUid ? 'win' : 'lose';
    } else if (game.status === 'draw') {
      status = "It's a draw";
      statusTone = 'draw';
    } else {
      status = `${myTurn ? 'Your move' : `${otherName}'s move`}${chess.inCheck() ? ' · Check!' : ''}`;
      statusTone = myTurn ? 'turn' : 'wait';
    }
  }
  const toneColor = statusTone === 'turn' ? BUDDY.leaf : statusTone === 'win' ? BUDDY.leaf : statusTone === 'lose' ? BUDDY.coral : statusTone === 'draw' ? BUDDY.sky : c.text3;

  // Captured pieces: what each side is missing from a full set.
  const lost = useMemo(() => {
    const full: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const out = { w: [] as string[], b: [] as string[] };
    if (!chess) return out;
    for (const color of ['w', 'b'] as const) {
      const have: Record<string, number> = {};
      for (const row of chess.board()) for (const sq of row) if (sq && sq.color === color) have[sq.type] = (have[sq.type] ?? 0) + 1;
      for (const t of ['q', 'r', 'b', 'n', 'p']) for (let i = 0; i < full[t] - (have[t] ?? 0); i++) out[color].push(t);
    }
    return out;
  }, [chess]);

  const player = (name: string, color: 'w' | 'b', turn: boolean) => (
    <View style={{ width: size + BOARD_CHROME, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, backgroundColor: c.card, borderWidth: 2, borderColor: turn ? BUDDY.leaf : 'transparent' }}>
      <BeamAvatar name={name || '?'} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
          {name}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 2, minHeight: 16 }}>
          {lost[color === 'w' ? 'b' : 'w'].map((t, i) => (
            <View key={i} style={{ marginRight: -6 }}>
              <Piece type={t} color={color === 'w' ? 'b' : 'w'} size={16} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color === 'w' ? '#FFFFFF' : '#2B2B2B', borderWidth: 2, borderColor: c.hairline }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.chatBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} hitSlop={10} style={{ width: 70 }}>
          <Glyph.Back color={c.blue} size={26} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: c.text, fontSize: 18, fontWeight: '800' }}>Chess</Text>
        <View style={{ width: 70, alignItems: 'flex-end' }}>
          {game?.status === 'playing' ? (
            <Pressable onPress={giveUp} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: c.search }}>
              <Text style={{ color: BUDDY.coral, fontSize: 14, fontWeight: '800' }}>Resign</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {!loaded ? (
        <Text style={{ color: c.text3, textAlign: 'center', marginTop: 40 }}>Loading game…</Text>
      ) : !game || !chess ? (
        <Text style={{ color: c.text3, textAlign: 'center', marginTop: 40 }}>{"This game isn't available."}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 6, paddingBottom: insets.bottom + 20, gap: 10 }}>
          {player(otherName, myColor === 'w' ? 'b' : 'w', !myTurn && game.status === 'playing')}
          <Board fen={game.fen} size={size} orientation={myColor} movable={myTurn ? myColor : null} onMove={(m) => void move(m)} lastMove={last} />
          {player(meName, myColor, myTurn)}

          <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: toneColor }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{status}</Text>
          </View>
          {err ? <Text style={{ color: BUDDY.coral, fontSize: 13 }}>{err}</Text> : null}
          {game.moves.length ? (
            <View style={{ width: size + BOARD_CHROME, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {game.moves.map((m, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: i === game.moves.length - 1 ? BUDDY.sky : c.search }}>
                  {i % 2 === 0 ? <Text style={{ color: i === game.moves.length - 1 ? '#FFFFFF' : c.text3, fontSize: 12, fontWeight: '700' }}>{`${i / 2 + 1}.`}</Text> : null}
                  <Text style={{ color: i === game.moves.length - 1 ? '#FFFFFF' : c.text, fontSize: 13, fontWeight: '800' }}>{m}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: c.text3, fontSize: 13 }}>{myColor === 'w' ? 'You play white. Drag or tap a piece to move.' : `You play black. ${otherName} moves first.`}</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
