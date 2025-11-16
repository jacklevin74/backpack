import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const DemoApp = (): JSX.Element => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>Backpack Crypto Demo</Text>
        <Text style={styles.subtitle}>Mobile Wallet Prototype</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Successfully Running!</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              This is a React Native app demonstrating Backpack wallet functionality.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>✓ React Native Integration</Text>
            <Text style={styles.featureItem}>✓ Expo Framework</Text>
            <Text style={styles.featureItem}>✓ Android APK Support</Text>
            <Text style={styles.featureItem}>✓ Dark Theme UI</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Backpack</Text>
          <Text style={styles.footerSubtext}>Mobile Wallet Demo</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4ecca3',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a40',
  },
  cardText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  featuresList: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a40',
  },
  featureItem: {
    color: '#4ecca3',
    fontSize: 14,
    marginBottom: 8,
    paddingLeft: 8,
  },
  footer: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#666',
    fontSize: 12,
  },
});

export default DemoApp;
