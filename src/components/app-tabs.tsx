import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/ui/tokens';

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={styles.button}>
    <Text style={[styles.label, isFocused && styles.selected]}>{children}</Text>
  </Pressable>;
}

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  return <Tabs style={styles.container}>
    <TabSlot style={styles.content} />
    <TabList style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <TabTrigger name="home" href="/" asChild><TabButton>Home</TabButton></TabTrigger>
      <TabTrigger name="map" href="/map" asChild><TabButton>Map</TabButton></TabTrigger>
      <TabTrigger name="prepare" href="/prepare" asChild><TabButton>Prepare</TabButton></TabTrigger>
    </TabList>
  </Tabs>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { flex: 1 },
  bar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', paddingTop: 8 },
  button: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '500', color: colors.secondary, paddingHorizontal: 16, paddingVertical: 8 },
  selected: { color: colors.ink, fontWeight: '700', borderBottomWidth: 2, borderBottomColor: colors.ink },
});
