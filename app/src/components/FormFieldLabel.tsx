import React from 'react';
import { Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type IconSet = 'feather' | 'ion' | 'material';

interface FormFieldLabelProps {
  icon: string;
  title: string;
  iconSet?: IconSet;
  styles: {
    fieldLabelRow: object;
    fieldLabelIconWrap: object;
    fieldLabel: object;
  };
}

export default function FormFieldLabel({
  icon,
  title,
  iconSet = 'feather',
  styles,
}: FormFieldLabelProps) {
  return (
    <View style={styles.fieldLabelRow}>
      <View style={styles.fieldLabelIconWrap}>
        {iconSet === 'material' ? (
          <MaterialCommunityIcons
            name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={16}
            color={colors.primaryBase}
          />
        ) : iconSet === 'ion' ? (
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.primaryBase} />
        ) : (
          <Feather name={icon as keyof typeof Feather.glyphMap} size={16} color={colors.primaryBase} />
        )}
      </View>
      <Text style={styles.fieldLabel}>{title}</Text>
    </View>
  );
}
