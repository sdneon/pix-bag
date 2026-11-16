import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from './Btn';

export interface SheetAction { text: string; onPress: () => void; destructive?: boolean }

// Bottom menu with any number of actions (Android Alert shows at most 3 buttons).
export function ActionSheet({ title, subtitle, actions, onClose }: {
  title: string;
  subtitle?: string;
  actions: SheetAction[] | null;   // null = hidden
  onClose: () => void;
}) {
  return (
    <Modal visible={!!actions} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
          {(actions ?? []).map(a => (
            <TouchableOpacity key={a.text} style={styles.item} onPress={() => { onClose(); a.onPress(); }}>
              <Text style={[styles.itemText, a.destructive && styles.destructive]}>{a.text}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.item} onPress={onClose}>
            <Text style={[styles.itemText, styles.cancel]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'center' },
  box:         { backgroundColor: '#151515', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, width: '100%', maxWidth: 520 },
  title:       { color: C.text, fontSize: 16, fontWeight: '700' },
  sub:         { color: C.dim, fontSize: 12, marginTop: 2, marginBottom: 6 },
  item:        { paddingVertical: 14, borderTopWidth: 1, borderColor: '#222' },
  itemText:    { color: C.text, fontSize: 15 },
  destructive: { color: '#ff6b5b' },
  cancel:      { color: C.dim },
});
