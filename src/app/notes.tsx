/** Quick notes: tap New, type, done. Pinned notes stay on top. Saved on this phone. */
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Button, Screen, tap } from '@/components/ui';
import { TYPE } from '@/lib/fonts';
import { useTheme } from '@/lib/hooks';
import { addNote, deleteNote, togglePin, updateNote, useTools, type Note } from '@/lib/tools';
import { alpha } from '@/lib/themes';
import { sz } from '@/lib/scale';

function ago(ms: number) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ms).toLocaleDateString();
}

export default function Notes() {
  const theme = useTheme();
  const notes = useTools((t) => t.notes);
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Button title="New note" onPress={() => setEditing(addNote(''))} />
        {sorted.length === 0 ? <Text style={{ ...TYPE.regular, fontSize: sz(15), color: theme.muted, textAlign: 'center', marginTop: 12 }}>No notes yet.</Text> : null}
        {sorted.map((n) => (
          <NoteCard key={n.id} n={n} editing={editing === n.id} onEdit={() => setEditing(n.id)} onDone={() => setEditing(null)} />
        ))}
        {sorted.length ? <Text style={{ ...TYPE.regular, fontSize: sz(12), color: theme.muted, textAlign: 'center' }}>Notes stay on this phone.</Text> : null}
        <View style={{ height: 8 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function NoteCard({ n, editing, onEdit, onDone }: { n: Note; editing: boolean; onEdit: () => void; onDone: () => void }) {
  const theme = useTheme();
  const remove = () => {
    if (Platform.OS === 'web' || !n.text.trim()) return deleteNote(n.id);
    Alert.alert('Delete this note?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNote(n.id) },
    ]);
  };
  return (
    <View style={{ backgroundColor: theme.panel, borderRadius: 18, padding: 14, gap: 8, borderWidth: n.pinned ? 1.5 : 0, borderColor: alpha(theme.accent, 0.6) }}>
      {editing ? (
        <TextInput
          autoFocus
          multiline
          value={n.text}
          onChangeText={(t) => updateNote(n.id, t)}
          onBlur={() => {
            if (!n.text.trim()) deleteNote(n.id);
            onDone();
          }}
          placeholder="Write something…"
          placeholderTextColor={alpha(theme.ink, 0.35)}
          selectionColor={theme.accent}
          style={{ ...TYPE.regular, fontSize: sz(17), lineHeight: sz(23), color: theme.ink, minHeight: sz(80), textAlignVertical: 'top' }}
        />
      ) : (
        <Pressable accessibilityRole="button" accessibilityHint="Edit note" onPress={onEdit}>
          <Text style={{ ...TYPE.regular, fontSize: sz(17), lineHeight: sz(23), color: theme.ink }} numberOfLines={8}>
            {n.text || 'Empty note'}
          </Text>
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Text style={{ ...TYPE.regular, fontSize: sz(12), color: theme.muted, flex: 1 }}>{ago(n.updatedAt)}</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            tap();
            togglePin(n.id);
          }}>
          <Text style={{ ...TYPE.semibold, fontSize: sz(13), color: n.pinned ? theme.accent : theme.muted }}>{n.pinned ? 'Pinned' : 'Pin'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={remove}>
          <Text style={{ ...TYPE.semibold, fontSize: sz(13), color: '#ff6b5e' }}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}
