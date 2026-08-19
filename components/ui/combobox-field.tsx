"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export interface ComboboxFieldItem {
  value: string;
  label: string;
}

export function ComboboxField({
  items,
  value,
  onValueChange,
  placeholder = "Buscar...",
  emptyText = "Sin resultados",
  className,
  disabled,
}: {
  items: ComboboxFieldItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const selected = items.find((item) => item.value === value) ?? null;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(v) => onValueChange((v as ComboboxFieldItem | null)?.value ?? "")}
      isItemEqualToValue={(a: ComboboxFieldItem, b: ComboboxFieldItem) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxInput placeholder={placeholder} className={className} showClear />
      <ComboboxContent>
        <ComboboxList>
          {(item: ComboboxFieldItem) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
