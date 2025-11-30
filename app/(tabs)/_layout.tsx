import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Linking, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const PHONE_NUMBER = '+4979197825477';
  const WHATSAPP_NUMBER = '4979197825477';
  const EMAIL_ADDRESS = 'info@haarmonie-sha.de';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 105,
          paddingTop: 12,
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 1,
        },
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
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  opacity: focused ? 1 : 0.75,
                  width: '100%',
                }}
              >
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${PHONE_NUMBER}`).catch(() => {})}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 999,
                    width: 55,
                    height: 55,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#ead1d1ff',
                  }}
                  accessibilityLabel="Salon anrufen"
                >
                  <Ionicons name="call-outline" size={22} color="#2f2415" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`).catch(() => {})}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 999,
                    width: 55,
                    height: 55,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#eaded1',
                  }}
                  accessibilityLabel="Salon per WhatsApp kontaktieren"
                >
                  <FontAwesome5 name="whatsapp" size={22} color="#128C7E" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const subject = encodeURIComponent('Terminanfrage');
                    const body = encodeURIComponent('Hallo Haarmonie-Team,\nich möchte gerne einen Termin buchen.');
                    Linking.openURL(`mailto:${EMAIL_ADDRESS}?subject=${subject}&body=${body}`).catch(() => {});
                  }}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 999,
                    width: 55,
                    height: 55,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#eaded1',
                  }}
                  accessibilityLabel="Salon per E-Mail kontaktieren"
                >
                  <Ionicons name="mail-outline" size={22} color="#2f2415" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://www.haarmonie-sha.de').catch(() => {})}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 999,
                    width: 55,
                    height: 55,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#eaded1',
                  }}
                  accessibilityLabel="Webseite öffnen"
                >
                  <Ionicons name="globe-outline" size={22} color="#2f2415" />
                </TouchableOpacity>
              </View>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
