import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getPublicPrivacyPolicy } from '../services/platformSettings';
import { styles } from '../styles/PrivacyPolicyScreen.styles';
import { colors } from '../theme/colors';

interface PrivacyPolicyScreenProps {
  onBack: () => void;
}

type ContentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string };

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseHtmlContent(html: string): ContentBlock[] {
  const normalizedHtml = html.replace(/\r?\n/g, ' ');
  const matcher = /<(h1|h2|h3|h4|h5|h6|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks: ContentBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(normalizedHtml)) !== null) {
    const tagName = match[1].toLowerCase();
    const text = stripTags(match[2]);

    if (!text) {
      continue;
    }

    if (tagName === 'p') {
      blocks.push({ type: 'paragraph', text });
      continue;
    }

    if (tagName === 'li') {
      blocks.push({ type: 'bullet', text });
      continue;
    }

    const level = tagName === 'h1' ? 1 : tagName === 'h2' ? 2 : 3;
    blocks.push({ type: 'heading', level, text });
  }

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', text: stripTags(normalizedHtml) }];
}

export default function PrivacyPolicyScreen({ onBack }: PrivacyPolicyScreenProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);

    try {
      const result = await getPublicPrivacyPolicy();
      const nextHtml = result.html?.trim() || '';

      setBlocks(nextHtml ? parseHtmlContent(nextHtml) : []);
    } catch {
      setBlocks([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => subscription.remove();
  }, [onBack]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={24} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={colors.primaryStrong} />
          <Text style={styles.stateText}>Loading privacy policy...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.documentContent}>
            {loadFailed ? (
              <Text style={[styles.block, styles.paragraph]}>
                We could not load the privacy policy from the server right now.
              </Text>
            ) : blocks.length === 0 ? (
              <Text style={[styles.block, styles.paragraph]}>
                No privacy policy has been published yet.
              </Text>
            ) : (
              blocks.map((block, index) => {
                if (block.type === 'heading') {
                  const headingStyle =
                    block.level === 1 ? styles.heading1 : block.level === 2 ? styles.heading2 : styles.heading3;

                  return (
                    <Text key={`${block.type}-${index}`} style={[styles.block, headingStyle]}>
                      {block.text}
                    </Text>
                  );
                }

                if (block.type === 'bullet') {
                  return (
                    <View key={`${block.type}-${index}`} style={styles.bulletRow}>
                      <Text style={styles.bullet}>{'\u2022'}</Text>
                      <Text style={styles.bulletText}>{block.text}</Text>
                    </View>
                  );
                }

                return (
                  <Text key={`${block.type}-${index}`} style={[styles.block, styles.paragraph]}>
                    {block.text}
                  </Text>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
