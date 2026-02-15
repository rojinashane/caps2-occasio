// components/CustomText.js
import React from 'react';
import { Text } from 'react-native';
import tw from 'twrnc';

const CustomText = ({ style, fontFamily, children, ...props }) => {
  let chosenFont = 'Poppins-Regular'; // Default font

  // Apply the font family based on the prop passed
  if (fontFamily === 'medium') {
    chosenFont = 'Poppins-Medium';
  } else if (fontFamily === 'bold') {
    chosenFont = 'Poppins-Bold';
  }

  return (
    <Text
      {...props}
      style={[tw`text-base text-gray-700`, { fontFamily: chosenFont }, style]} // Add custom styles
    >
      {children}
    </Text>
  );
};

export default CustomText;
