import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

export function SlideView({ 
  children, 
  direction = 'right',
  duration = 300
}: { 
  children: React.ReactNode, 
  direction?: 'right' | 'bottom',
  duration?: number
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 4,
      speed: 12
    }).start();
  }, [anim]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, {
      transform: direction === 'right' 
        ? [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }]
        : [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [800, 0] }) }]
    }]}>
      {children}
    </Animated.View>
  );
}
