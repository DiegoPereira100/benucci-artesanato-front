import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <TouchableOpacity
          key={i}
          style={[styles.pageButton, currentPage === i && styles.activePageButton]}
          onPress={() => onPageChange(i)}
        >
          <Text style={[styles.pageText, currentPage === i && styles.activePageText]}>
            {i + 1}
          </Text>
        </TouchableOpacity>
      );
    }
    return pages;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.navButton, currentPage === 0 && styles.disabledButton]}
        onPress={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
      >
        <Ionicons name="chevron-back" size={20} color={currentPage === 0 ? '#ccc' : '#333'} />
      </TouchableOpacity>

      <View style={styles.pagesContainer}>{renderPageNumbers()}</View>

      <TouchableOpacity
        style={[styles.navButton, currentPage === totalPages - 1 && styles.disabledButton]}
        onPress={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages - 1}
      >
        <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages - 1 ? '#ccc' : '#333'} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  pagesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pageButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
  },
  activePageButton: {
    backgroundColor: '#00BCD4',
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pageText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  activePageText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
