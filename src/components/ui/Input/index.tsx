import React, { useState } from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { styles } from './styles';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: any;
};

export function Input({ label, error, style, containerStyle, onFocus, onBlur, ...rest }: Props) {
  const [isFocused, setIsFocused] = useState(false);

  function handleFocus(e: any) {
    setIsFocused(true);
    onFocus?.(e);
  }

  function handleBlur(e: any) {
    setIsFocused(false);
    onBlur?.(e);
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          rest.editable === false && styles.inputDisabled,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
          style,
        ]}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholderTextColor="#999"
        cursorColor="#00BCD4"
        selectionColor="#00BCD4"
        {...rest}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}
