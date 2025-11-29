import { TouchableOpacity, TouchableOpacityProps, Text, ActivityIndicator } from 'react-native';
import { styles } from './styles';

type Props = TouchableOpacityProps & {
  title: string;
  isLoading?: boolean;
}

export function Button({ title, isLoading = false, ...rest }: Props) {
  return (
      <TouchableOpacity 
        activeOpacity={0.5} 
        style={[styles.button, (isLoading || rest.disabled) && styles.buttonDisabled]} 
        disabled={isLoading || rest.disabled}
        { ...rest }
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>{title}</Text>
        )}
      </TouchableOpacity>
  )
}