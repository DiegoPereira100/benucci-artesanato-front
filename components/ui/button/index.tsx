import { TouchableOpacity, TouchableOpacityProps, Text } from 'react-native';
import { styles } from './styles';

type Props = TouchableOpacityProps & {
  title: string;
}

export function Button({ title, ...rest }: Props) {
  return (
      <TouchableOpacity activeOpacity={0.5} style={styles.button} { ...rest }>
        <Text style={styles.buttonText}>{title}</Text>
      </TouchableOpacity>
  )
}