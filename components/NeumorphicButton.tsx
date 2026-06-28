import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

type NeumorphicButtonProps = {
  label: string;
  isOn: boolean;
  isLoading: boolean;
  onPress: () => void;
  iconName?: React.ComponentProps<typeof FontAwesome>['name'];
};

export function NeumorphicButton({ label, isOn, isLoading, onPress, iconName = 'power-off' }: NeumorphicButtonProps) {
  const bgColor = '#E0E5EC';

  return (
    <Pressable onPress={onPress} disabled={isLoading} style={styles.wrapper}>
      {/* Dark shadow layer */}
      <View style={[styles.shadowLayer, !isOn && styles.darkShadow, { backgroundColor: bgColor }]}>
        {/* Light shadow layer */}
        <View style={[styles.shadowLayer, !isOn && styles.lightShadow, { backgroundColor: bgColor }]}>
          {/* Inner Content (Pressed state alters background) */}
          <View style={[styles.content, isOn && styles.contentPressed]}>
            {isLoading ? (
              <ActivityIndicator size="small" color={isOn ? '#0A84FF' : '#8E8E93'} />
            ) : (
              <FontAwesome 
                name={iconName} 
                size={24} 
                color={isOn ? '#0A84FF' : '#8E8E93'} 
                style={isOn ? styles.iconGlowing : null}
              />
            )}
            <Text style={[styles.label, isOn ? styles.labelOn : styles.labelOff]} numberOfLines={2}>
              {label}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '28%',
    aspectRatio: 1,
    marginVertical: 12,
    marginHorizontal: '2.6%',
  },
  shadowLayer: {
    flex: 1,
    borderRadius: 24,
  },
  darkShadow: {
    shadowColor: '#a3b1c6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  lightShadow: {
    shadowColor: '#ffffff',
    shadowOffset: { width: -6, height: -6 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  content: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: 'transparent',
  },
  contentPressed: {
    backgroundColor: '#d1d9e6',
    borderWidth: 2,
    borderColor: '#c0c8d6',
  },
  iconGlowing: {
    textShadowColor: 'rgba(10, 132, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  label: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelOff: {
    color: '#8E8E93',
  },
  labelOn: {
    color: '#0A84FF',
  },
});
