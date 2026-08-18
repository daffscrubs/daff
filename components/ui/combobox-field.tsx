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
  return (
    <Combobox
      items={items}
      value={value || null}
      onValueChange={(v) => onValueChange((v as string | null) ?? "")}
      disabled={disabled}
    >
      <ComboboxInput placeholder={placeholder} className={className} showClear />
      <ComboboxContent>
        <ComboboxList>
          {(item: ComboboxFieldItem) => (
            <ComboboxItem key={item.value} value={item.value}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
