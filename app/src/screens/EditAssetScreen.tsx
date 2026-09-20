import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather, Ionicons } from '@expo/vector-icons';
import FormFieldLabel from '../components/FormFieldLabel';
import { useDialog } from '../context/DialogContext';
import { getAssetCategoryIconName, getAssetCategoryOption, listAssetCategories } from '../services/assetCategories';
import { toAbsoluteAssetUrl, updateOwnerAsset } from '../services/ownerAssets';
import type { AssetCategory } from '../types/assetCategory';
import type { AssetRecord } from '../types/asset';
import { styles } from '../styles/EditAssetScreen.styles';
import { getErrorMessage } from '../utils/error';
import { colors } from '../theme/colors';

const NOTES_MAX_LENGTH = 200;
const ASSET_NAME_MAX_LENGTH = 30;

interface EditAssetScreenProps {
  asset: AssetRecord;
  token: string;
  onBack: () => void;
  onSaved: () => void;
}

interface DropdownLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function EditAssetScreen({ asset, token, onBack, onSaved }: EditAssetScreenProps) {
  const dialog = useDialog();
  const [name, setName] = useState(asset.name);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(asset.categoryId || null);
  const [notes, setNotes] = useState(asset.notes || '');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState<DropdownLayout | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const categoryTriggerRef = useRef<View>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const selectedCategory = useMemo(() => {
    if (selectedCategoryId !== null) {
      return categories.find((item) => item.id === selectedCategoryId) || null;
    }

    return getAssetCategoryOption(asset.type, categories);
  }, [asset.type, categories, selectedCategoryId]);
  const selectedCategoryLabel = selectedCategory?.label || asset.type || '';
  const previewImageUri = selectedImageUri || toAbsoluteAssetUrl(asset.images?.[0]);
  const dropdownPlacement = useMemo(() => {
    if (!dropdownLayout) {
      return null;
    }

    const margin = 16;
    const gap = 8;
    const width = Math.min(dropdownLayout.width, windowWidth - margin * 2);
    const left = Math.min(Math.max(margin, dropdownLayout.x), windowWidth - width - margin);
    const availableBelow = windowHeight - (dropdownLayout.y + dropdownLayout.height + gap + margin);
    const availableAbove = dropdownLayout.y - gap - margin;
    const preferAbove = availableBelow < 220 && availableAbove > availableBelow;
    const maxHeight = Math.max(160, Math.min(280, preferAbove ? availableAbove : availableBelow));
    const top = preferAbove
      ? Math.max(margin, dropdownLayout.y - maxHeight - gap)
      : dropdownLayout.y + dropdownLayout.height + gap;

    return {
      left,
      top,
      width,
      maxHeight,
    };
  }, [dropdownLayout, windowHeight, windowWidth]);

  useEffect(() => {
    let isActive = true;

    listAssetCategories()
      .then((result) => {
        if (!isActive) {
          return;
        }

        setCategories(result);
        setCategoriesError(result.length === 0 ? 'No categories are configured yet.' : null);

        if (asset.categoryId) {
          const matchingById = result.find((item) => item.id === asset.categoryId);
          if (matchingById) {
            setSelectedCategoryId(matchingById.id);
            return;
          }
        }

        const matchingByType = getAssetCategoryOption(asset.type, result);
        if (matchingByType) {
          setSelectedCategoryId(matchingByType.id);
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setCategories([]);
        setCategoriesError(getErrorMessage(error, 'Failed to load categories'));
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCategories(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [asset.categoryId, asset.type]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
      selectionLimit: 1,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setSelectedImageUri(result.assets[0].uri);
    }
  };

  const validateForm = () => {
    let hasError = false;

    if (!name.trim()) {
      setNameError('This field is required.');
      hasError = true;
    } else {
      setNameError(null);
    }

    if (!selectedCategory) {
      setTypeError(categoriesError || 'Select a valid category');
      hasError = true;
    } else {
      setTypeError(null);
    }

    return !hasError;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const categoryId = selectedCategory?.id;

    if (!categoryId) {
      setTypeError(categoriesError || 'Select a valid category');
      return;
    }

    setSubmitting(true);

    try {
      await updateOwnerAsset({
        token,
        assetId: asset.id,
        name: name.trim(),
        categoryId,
        notes: notes.trim(),
        imageUri: selectedImageUri || undefined,
      });

      onSaved();
    } catch (error: unknown) {
      void dialog.alert({
        title: 'Update failed',
        message: getErrorMessage(error, 'Failed to update asset'),
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openCategoryDropdown = () => {
    categoryTriggerRef.current?.measureInWindow((x, y, width, height) => {
      if (categories.length === 0) {
        return;
      }

      setDropdownLayout({ x, y, width, height });
      setIsCategoryDropdownOpen(true);
    });
  };

  const closeCategoryDropdown = () => {
    setIsCategoryDropdownOpen(false);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={24} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Asset</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formSection}>
          <FormFieldLabel icon="edit-3" title="Asset Name" styles={styles} />
          <View style={styles.fieldWrap}>
            <TextInput
              style={[styles.textField, styles.textFieldWithCounter, nameError ? styles.textFieldError : null]}
              placeholder="Enter asset name"
              placeholderTextColor={colors.textMuted}
              value={name}
              maxLength={ASSET_NAME_MAX_LENGTH}
              onChangeText={(value) => {
                setName(value);
                if (nameError) {
                  setNameError(null);
                }
              }}
            />
            <Text style={styles.fieldCounterText}>{name.length}/{ASSET_NAME_MAX_LENGTH}</Text>
          </View>
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
        </View>

        <View style={[styles.formSection, isCategoryDropdownOpen ? styles.formSectionRaised : null]}>
          <FormFieldLabel icon="grid" title="Category / Type" styles={styles} />
          <View style={styles.selectWrap}>
            <View ref={categoryTriggerRef} collapsable={false}>
              <TouchableOpacity
                style={[styles.selectField, typeError ? styles.textFieldError : null]}
                activeOpacity={0.85}
                onPress={openCategoryDropdown}
                disabled={isLoadingCategories || categories.length === 0}
              >
                <Text style={selectedCategoryLabel ? styles.selectValue : styles.selectPlaceholder}>
                  {selectedCategoryLabel ||
                    (isLoadingCategories
                      ? 'Loading categories...'
                      : categoriesError || 'Select category')}
                </Text>
                <Ionicons
                  name={isCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
          {typeError ? <Text style={styles.errorText}>{typeError}</Text> : null}
        </View>

        <View style={styles.formSection}>
          <FormFieldLabel icon="file-text" title="Additional Notes (Optional)" styles={styles} />
          <View style={[styles.textAreaWrap, styles.textAreaWrapWithCounter]}>
            <TextInput
              style={[styles.textField, styles.textArea]}
              placeholder="Add any additional notes about your asset..."
              placeholderTextColor={colors.textMuted}
              value={notes}
              maxLength={NOTES_MAX_LENGTH}
              multiline
              textAlignVertical="top"
              onChangeText={setNotes}
            />
            <Text style={styles.counterText}>{notes.length}/{NOTES_MAX_LENGTH}</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <FormFieldLabel icon="image" title="Add Image" styles={styles} />
          <TouchableOpacity
            style={previewImageUri ? styles.imagePreviewCard : styles.imageUploadCard}
            activeOpacity={0.86}
            onPress={pickImage}
          >
            {previewImageUri ? (
              <>
                <Image source={{ uri: previewImageUri }} style={styles.previewImageLarge} resizeMode="cover" />
                <View style={styles.changeImageRow}>
                  <Feather name="edit-2" size={14} color={colors.primaryBase} />
                  <Text style={styles.changeImageText}>Change image</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.imageUploadIconWrap}>
                  <Ionicons name="image-outline" size={28} color={colors.primaryBase} />
                  <View style={styles.imageUploadPlusBadge}>
                    <Ionicons name="add" size={12} color={colors.white} />
                  </View>
                </View>
                <Text style={styles.imageUploadTitle}>Tap to add an image</Text>
                <Text style={styles.imageUploadHint}>JPG, PNG up to 5MB</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting ? styles.submitBtnDisabled : null]}
          activeOpacity={0.9}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>Update Asset</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} activeOpacity={0.75} onPress={onBack}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={isCategoryDropdownOpen}
        onRequestClose={closeCategoryDropdown}
      >
        <View style={styles.categoryModalRoot}>
          <TouchableOpacity
            style={styles.categoryModalBackdrop}
            activeOpacity={1}
            onPress={closeCategoryDropdown}
          />

          {dropdownPlacement ? (
            <View
              style={[
                styles.categoryDropdownCard,
                {
                  left: dropdownPlacement.left,
                  top: dropdownPlacement.top,
                  width: dropdownPlacement.width,
                  maxHeight: dropdownPlacement.maxHeight,
                },
              ]}
            >
              <ScrollView
                style={styles.categoryDropdownScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {categories.map((item, index) => {
                  const isSelected = item.id === selectedCategoryId;
                  const showDivider = index < categories.length - 1;

                  return (
                    <View key={item.id}>
                      <TouchableOpacity
                        style={[styles.categoryOption, isSelected ? styles.categoryOptionSelected : null]}
                        activeOpacity={0.86}
                        onPress={() => {
                          setSelectedCategoryId(item.id);
                          setTypeError(null);
                          closeCategoryDropdown();
                        }}
                      >
                        <View style={styles.categoryOptionLeft}>
                          <View style={[styles.categoryOptionIconWrap, isSelected ? styles.categoryOptionIconWrapSelected : null]}>
                            <Ionicons
                              name={getAssetCategoryIconName(item)}
                              size={18}
                              color={isSelected ? colors.white : colors.primaryBase}
                            />
                          </View>
                          <Text style={[styles.categoryOptionText, isSelected ? styles.categoryOptionTextSelected : null]}>
                            {item.label}
                          </Text>
                        </View>

                        {isSelected ? <Ionicons name="checkmark" size={20} color={colors.white} /> : null}
                      </TouchableOpacity>
                      {showDivider ? <View style={styles.categoryOptionDivider} /> : null}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
