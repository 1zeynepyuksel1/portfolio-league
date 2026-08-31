const fs = require('fs');

let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// Strip out all multiple imports of lucide and react
pc = pc.replace(/import \{.*\} from 'lucide-react-native';/g, '');
pc = pc.replace(/import React.*from 'react';/g, '');
pc = pc.replace(/import \{ useState \} from 'react';/g, '');
pc = pc.replace(/import \{ Modal, ActivityIndicator \} from 'react-native';/g, '');

const correctImports = \import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Globe, Users, TrendingUp, TrendingDown, Heart, MessageSquare, MoreVertical, Trash2, Edit2, Pin } from 'lucide-react-native';\;

pc = pc.replace(/import \{ View, Text, StyleSheet, Image, TouchableOpacity \} from 'react-native';/g, correctImports);

// Fix Props
pc = pc.replace(/export type Props = \{[\s\S]*?\};/, \export type Props = {
  post: any;
  user: any;
  isPreview?: boolean;
  onPressUser?: (username: string) => void;
  currentUsername?: string;
};\);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
