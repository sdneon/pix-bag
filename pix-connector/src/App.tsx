import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { DeviceListScreen } from './screens/DeviceListScreen';
import { ControlScreen, NavigateTo } from './screens/ControlScreen';
import { BikeScreen } from './screens/BikeScreen';
import { PixelBreakerScreen } from './screens/PixelBreakerScreen';
import { AnimationEditorScreen, EditorSource } from './screens/AnimationEditorScreen';
import { GalleryScreen } from './screens/GalleryScreen';
import { ScrollingTextScreen } from './screens/ScrollingTextScreen';
import { DiceScreen } from './screens/DiceScreen';
import { CountdownScreen } from './screens/CountdownScreen';
import { ClockScreen } from './screens/ClockScreen';
import type { Backpack } from './ble/Backpack';
import BleService, { BLE_EVENTS } from './ble/BleService';

type Route =
  | { name: 'gallery' }
  | { name: 'editor'; source: EditorSource }
  | { name: 'device' }
  | { name: Exclude<NavigateTo, 'animation-editor'> };

const DEFAULT_SIZE = { w: 16, h: 20 };

// Screens live in a stack and stay mounted underneath, so e.g. the editor keeps
// unsaved work while the device page is open on top of it.
export default function App() {
  const [device, setDevice] = useState<Backpack | null>(null);
  const [deviceSize, setDeviceSize] = useState<{ w: number; h: number } | null>(null);
  const [linkUp, setLinkUp] = useState(false);

  // Track the BLE link so the gallery chip shows drops (Device page offers reconnect).
  useEffect(() => {
    if (!device) return;
    const offDown = BleService.on(BLE_EVENTS.DISCONNECTED, ({ peripheral }: { peripheral: string }) => {
      if (peripheral === device.id) setLinkUp(false);
    });
    const offUp = BleService.on(BLE_EVENTS.CONNECTED, ({ peripheral }: { peripheral: string }) => {
      if (peripheral === device.id) setLinkUp(true);
    });
    return () => { offDown(); offUp(); };
  }, [device]);
  const [stack, setStack] = useState<{ key: number; route: Route }[]>([{ key: 0, route: { name: 'gallery' } }]);
  const nextKey = useRef(1);

  const push = useCallback((route: Route) => {
    setStack(s => [...s, { key: nextKey.current++, route }]);
  }, []);
  const pop = useCallback(() => setStack(s => (s.length > 1 ? s.slice(0, -1) : s)), []);

  // Registered once, so screens' own handlers (added later) get the back press first.
  const depth = useRef(1);
  depth.current = stack.length;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (depth.current <= 1) return false;
      pop();
      return true;
    });
    return () => sub.remove();
  }, [pop]);

  function connected(d: Backpack) {
    setDevice(d);
    setLinkUp(true);
    Promise.all([d.readWidth(), d.readHeight()])
      .then(([w, h]) => setDeviceSize({ w, h }))
      .catch(() => {});
  }

  function disconnected() {
    setDevice(null);
    setDeviceSize(null);
  }

  function render(route: Route, active: boolean) {
    switch (route.name) {
      case 'gallery':
        return (
          <GalleryScreen
            device={device}
            linkUp={linkUp}
            active={active}
            onOpen={src => push({ name: 'editor', source: src })}
            onNew={() => {
              const s = deviceSize ?? DEFAULT_SIZE;
              push({ name: 'editor', source: { kind: 'new', w: s.w, h: s.h } });
            }}
            onDevice={() => push({ name: 'device' })}
          />
        );
      case 'editor':
        return (
          <AnimationEditorScreen
            source={route.source}
            device={device}
            deviceSize={deviceSize}
            active={active}
            onBack={pop}
            onNeedDevice={() => push({ name: 'device' })}
          />
        );
      case 'device':
        return device ? (
          <ControlScreen
            device={device}
            onBack={pop}
            onDisconnect={disconnected}
            onNavigate={to => (to === 'animation-editor' ? pop() : push({ name: to }))}
          />
        ) : (
          <DeviceListScreen onDeviceSelected={connected} onBack={pop} />
        );
    }
    if (!device) return null;
    switch (route.name) {
      case 'bike': return <BikeScreen device={device} onBack={pop} />;
      case 'pixel-breaker': return <PixelBreakerScreen device={device} onBack={pop} />;
      case 'scrolling-text': return <ScrollingTextScreen device={device} onBack={pop} />;
      case 'dice': return <DiceScreen device={device} onBack={pop} />;
      case 'countdown': return <CountdownScreen device={device} onBack={pop} />;
      case 'clock': return <ClockScreen device={device} onBack={pop} />;
    }
    return null;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {stack.map((e, i) => {
        const active = i === stack.length - 1;
        return (
          <View key={e.key} style={active ? styles.screen : styles.hidden}>
            {render(e.route, active)}
          </View>
        );
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0a0a0a' },
  screen: { flex: 1 },
  hidden: { display: 'none' },
});
