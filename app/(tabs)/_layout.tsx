import { Tabs } from 'expo-router';
import React from 'react';
import { Image, Linking } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const logo = require('../../assets/logo.png');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarButton: (props) => (
            <HapticTab
              {...props}
              onPress={(ev) => {
                Linking.openURL('https://www.haarmonie-sha.de').catch(() => {});
                props.onPress?.(ev);
              }}
            />
          ),
          tabBarIcon: ({ focused }) => (
            <Image
              source={logo}
              style={{
                width: 180,
                height: 150,
                resizeMode: 'contain',
                opacity: focused ? 1 : 0.7,
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
