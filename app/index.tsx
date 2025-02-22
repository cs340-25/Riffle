import { View, StyleSheet, Text } from "react-native";
import { Link } from 'expo-router';
import * as React from 'react';

import Button from '@/components/Button';
import Logo from '@/components/logo';
import HomeButton from "@/components/imagebutton";
import SettingsButton from "@/components/settingswheel";
import StatsButton from "@/components/statsbutton";

export default function Index() {
  return (
    <View style={styles.container}>
      <Link href="http://localhost:8888">
        <Button theme="login-button" label="Login to Spotify" />
      </Link>
      <Logo />
      <HomeButton />
      <SettingsButton />
      <StatsButton />
    </View>
  );
}

const getTokenFromUrl = (): Record<string, string> => {
  return window.location.hash.substring(1).split('&').reduce((initial, item) => {
    let parts = item.split("=");
    initial[parts[0]] = decodeURIComponent(parts[1]);
    return initial;
  }, {} as Record<string, string>);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
});