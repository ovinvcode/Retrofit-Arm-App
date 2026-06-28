import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, NativeSyntheticEvent, NativeScrollEvent, Dimensions } from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;

interface WheelPickerProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: number;
}

export const WheelPicker: React.FC<WheelPickerProps> = ({ items, selectedIndex, onChange, width = 80 }) => {
  const flatListRef = useRef<FlatList>(null);
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(selectedIndex);

  // Add padding elements at start and end
  const paddingCount = Math.floor(VISIBLE_ITEMS / 2);
  const paddedItems = [
    ...Array(paddingCount).fill(''),
    ...items,
    ...Array(paddingCount).fill(''),
  ];

  useEffect(() => {
    if (selectedIndex !== internalSelectedIndex && flatListRef.current) {
      setInternalSelectedIndex(selectedIndex);
      flatListRef.current.scrollToOffset({
        offset: selectedIndex * ITEM_HEIGHT,
        animated: true,
      });
    }
  }, [selectedIndex]);

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    let index = Math.round(offsetY / ITEM_HEIGHT);
    
    if (index < 0) index = 0;
    if (index >= items.length) index = items.length - 1;

    setInternalSelectedIndex(index);
    onChange(index);
  };

  const renderItem = ({ item, index }: { item: string; index: number }) => {
    const actualIndex = index - paddingCount;
    const isSelected = actualIndex === internalSelectedIndex;
    const isPadding = item === '';

    return (
      <View style={[styles.itemContainer, { height: ITEM_HEIGHT }]}>
        {!isPadding && (
          <Text style={[
            styles.itemText,
            isSelected && styles.selectedItemText
          ]}>
            {item}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { width, height: ITEM_HEIGHT * VISIBLE_ITEMS }]}>
      <View style={[styles.selectionOverlay, { top: paddingCount * ITEM_HEIGHT, height: ITEM_HEIGHT }]} />
      <FlatList
        ref={flatListRef}
        data={paddedItems}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={selectedIndex}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#E0E5EC',
    borderRadius: 16,
    shadowColor: '#ffffff',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  itemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 20,
    color: '#A3B1C6',
    fontWeight: '500',
  },
  selectedItemText: {
    fontSize: 24,
    color: '#0A84FF',
    fontWeight: 'bold',
  },
  selectionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(209, 217, 230, 0.4)', // Slightly darker for selection
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#c0c8d6',
    zIndex: -1,
  },
});
