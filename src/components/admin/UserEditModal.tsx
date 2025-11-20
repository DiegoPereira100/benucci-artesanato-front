import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { User, UserRole, UpdateUserRequest } from '@/types/auth';

interface UserEditModalProps {
  visible: boolean;
  user: User | null;
  loading?: boolean;
  onCancel: () => void;
  onSave: (payload: UpdateUserRequest) => void;
}

const defaultForm = {
  name: '',
  email: '',
  cpf: '',
  phoneNumber: '',
  address: '',
  role: 'USER' as UserRole,
};

const PRIMARY = '#FF6B35';

const UserEditModal: React.FC<UserEditModalProps> = ({ visible, user, loading = false, onCancel, onSave }) => {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (!visible) return;

    if (user) {
      setForm({
        name: user.name ?? '',
        email: user.email ?? '',
        cpf: user.cpf ?? '',
        phoneNumber: user.phoneNumber ?? '',
        address: user.address ?? '',
        role: (user.role ?? user.type ?? 'USER') as UserRole,
      });
    } else {
      setForm(defaultForm);
    }
  }, [user, visible]);

  const isSaveDisabled = useMemo(() => {
    return !user || !form.name.trim() || !form.email.trim();
  }, [form.email, form.name, user]);

  const handleChange = (field: keyof typeof form, value: string | UserRole) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!user) return;

    const payload: UpdateUserRequest = {
      name: form.name.trim(),
      email: form.email.trim(),
      cpf: form.cpf.replace(/\D/g, ''),
      phoneNumber: form.phoneNumber.replace(/\D/g, ''),
      address: form.address.trim(),
      type: form.role,
      role: form.role,
    };

    onSave(payload);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Editar Usuário</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              value={form.name}
              onChangeText={(text) => handleChange('name', text)}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="email@exemplo.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={form.email}
              onChangeText={(text) => handleChange('email', text)}
              editable={!loading}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.label}>CPF</Text>
              <TextInput
                style={styles.input}
                placeholder="Apenas números"
                keyboardType="numeric"
                maxLength={11}
                value={form.cpf}
                onChangeText={(text) => handleChange('cpf', text.replace(/\D/g, ''))}
                editable={!loading}
              />
            </View>

            <View style={[styles.inputGroup, styles.halfLeft]}>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                style={styles.input}
                placeholder="Apenas números"
                keyboardType="phone-pad"
                maxLength={11}
                value={form.phoneNumber}
                onChangeText={(text) => handleChange('phoneNumber', text.replace(/\D/g, ''))}
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Endereço (texto livre)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Rua, número, cidade"
              multiline
              numberOfLines={3}
              value={form.address}
              onChangeText={(text) => handleChange('address', text)}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                enabled={!loading}
                selectedValue={form.role}
                onValueChange={(value) => handleChange('role', value as UserRole)}
                style={styles.picker}
              >
                <Picker.Item label="Cliente" value="USER" />
                <Picker.Item label="Administrador" value="ADMIN" />
              </Picker>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={onCancel} disabled={loading}>
              <Text style={[styles.actionText, styles.cancelText]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton, (loading || isSaveDisabled) && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading || isSaveDisabled}
            >
              <Text style={styles.actionText}>{loading ? 'Salvando...' : 'Salvar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, default: 10 }),
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  half: {
    flex: 1,
    marginRight: 8,
  },
  halfLeft: {
    flex: 1,
    marginLeft: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 44,
    color: '#111827',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    backgroundColor: PRIMARY,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelText: {
    color: '#111827',
  },
});

export default UserEditModal;
