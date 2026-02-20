import React from 'react';
import { Text } from 'react-native';
import tw from 'twrnc';

// Using a map makes it much easier to add new weights later
const FONT_MAP = {
  light: 'Poppins-Light',
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semibold: 'Poppins-SemiBold', // Highly recommended for sleek UI elements
  bold: 'Poppins-Bold',
  extrabold: 'Poppins-ExtraBold',
};

const CustomText = ({
  style,
  fontFamily = 'regular',
  children,
  ...props
}) => {
  // Automatically fallback to 'regular' if an invalid font family string is passed
  const chosenFont = FONT_MAP[fontFamily?.toLowerCase()] || FONT_MAP.regular;

  return (
    <Text
      {...props}
      style={[
        tw`text-base text-gray-800`, // Changed to gray-800 for slightly crisper contrast on light backgrounds
        { fontFamily: chosenFont },
        style
      ]}
    >
      {children}
    </Text>
  );
};

export default CustomText;