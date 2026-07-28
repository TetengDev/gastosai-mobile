import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { errorMessage } from "../../../src/api/client";
import { deleteCategory, listCategories, renameCategory } from "../../../src/api/categories";
import { Body, Button, Card, Divider, ErrorText, Field, Skeleton } from "../../../src/components/ui";
import { useTheme } from "../../../src/theme/useTheme";

/**
 * Rename and remove categories.
 *
 * This is what makes the chips in the capture flow curatable from the phone: they are drawn from
 * this list, so a bad name typed once during a quick-add is fixable here rather than only on web.
 *
 * `bucket` (NEEDS / WANTS / SAVINGS) is shown but not editable — it drives the 50/30/20 rules,
 * which are a deliberate, wide, infrequent decision that belongs on a larger screen.
 */
export default function Categories() {
  const t = useTheme();
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  // Expenses carry a category name, so a rename changes how existing rows read — invalidate both.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameCategory(id, { name }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const remove = useMutation({ mutationFn: deleteCategory, onSuccess: invalidate });

  const confirmDelete = (id: number, name: string) =>
    Alert.alert(
      `Delete “${name}”?`,
      "Expenses already in this category keep their label; new ones cannot use it.",
      [
        { text: "Cancel", style: "cancel" },
        // Named, not a bare "Delete": each row carries its own Delete link.
        { text: "Delete category", style: "destructive", onPress: () => remove.mutate(id) },
      ],
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.page }}
      contentContainerStyle={{ padding: t.spacing.screen, gap: t.spacing.gap, paddingBottom: 96 }}
      keyboardShouldPersistTaps="handled"
    >
      {isLoading && <Skeleton height={200} />}
      <ErrorText>{isError ? errorMessage(error) : null}</ErrorText>

      <Card>
        {(data ?? []).map((c, i) => (
          <View key={c.id}>
            {i > 0 ? <Divider /> : null}
            {editingId === c.id ? (
              <View style={{ gap: 10, paddingVertical: 12 }}>
                <Field
                  testID="category-name"
                  label="Name"
                  value={draft}
                  onChangeText={setDraft}
                  autoCapitalize="words"
                  autoFocus
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      testID="category-save"
                      size="sm"
                      title="Save"
                      loading={rename.isPending}
                      onPress={() =>
                        draft.trim() && c.id != null
                          ? rename.mutate({ id: c.id, name: draft.trim() })
                          : undefined
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      title="Cancel"
                      onPress={() => setEditingId(null)}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: t.fonts.body, fontSize: 16, color: t.colors.textHi }}>
                    {c.name}
                  </Text>
                  {c.bucket ? (
                    <Text
                      style={{ fontFamily: t.fonts.body, fontSize: 12.5, color: t.colors.text2 }}
                    >
                      {c.bucket}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  testID={`category-rename-${c.id}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    setEditingId(c.id ?? null);
                    setDraft(c.name ?? "");
                  }}
                >
                  <Text style={{ fontFamily: t.fonts.bodyMedium, fontSize: 14, color: t.colors.link }}>
                    Rename
                  </Text>
                </Pressable>
                <Pressable
                  testID={`category-delete-${c.id}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => (c.id != null ? confirmDelete(c.id, c.name ?? "") : undefined)}
                >
                  <Text
                    style={{ fontFamily: t.fonts.bodyMedium, fontSize: 14, color: t.colors.danger }}
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </Card>

      <ErrorText>
        {rename.isError ? errorMessage(rename.error) : remove.isError ? errorMessage(remove.error) : null}
      </ErrorText>

      <Body dim style={{ fontSize: 12.5 }}>
        New categories are created automatically when you use one that does not exist yet.
      </Body>
    </ScrollView>
  );
}
