"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ActionList,
  ActionMenu as PrimerActionMenu,
  AnchoredOverlay,
  Button as PrimerButton,
  Checkbox as PrimerCheckbox,
  ConfirmationDialog,
  CounterLabel,
  Flash,
  FormControl,
  Label,
  Radio as PrimerRadio,
  SegmentedControl,
  SelectPanel,
  Spinner,
  TextInput as PrimerTextInput,
  Textarea as PrimerTextarea,
  Timeline as PrimerTimeline,
  ToggleSwitch as PrimerToggleSwitch,
  Tooltip as PrimerTooltip,
  UnderlineNav,
} from "@primer/react";
import { Blankslate, SkeletonText } from "@primer/react/experimental";
import {
  AlertIcon,
  CheckCircleFillIcon,
  DotFillIcon,
  InboxIcon,
  InfoIcon,
  SearchIcon,
  TriangleDownIcon,
  XCircleFillIcon,
} from "@primer/octicons-react";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "./toast";
import {
  PrimerGrid,
  type GridColumn,
  type PrimerGridProps,
  type GridPagination,
  type GridSorter,
} from "@/components/PrimerGrid";
import { PrimerModal } from "@/components/PrimerModal";

export { message };

export type ThemeConfig = any;
export type MenuProps = any;

export type ColumnType<T = any> = {
  title?: ReactNode;
  dataIndex?: keyof T | string | (string | number)[];
  key?: string | number;
  render?: (value: any, record: T, index: number) => ReactNode;
  width?: number | string;
  minWidth?: number;
  align?: "left" | "right" | "center";
  sorter?: boolean | ((a: T, b: T) => number);
  filters?: { text: ReactNode; value: any }[];
  onFilter?: (value: any, record: T) => boolean;
  ellipsis?: boolean;
  fixed?: "left" | "right" | boolean;
  className?: string;
  style?: CSSProperties;
  [key: string]: any;
};
export type ColumnsType<T = any> = ColumnType<T>[];

export const Grid = {
  useBreakpoint: () => ({ xs: false, sm: true, md: true, lg: true, xl: true, xxl: true }),
};

export function Result({ status = "info", title, subTitle, extra, style }: any) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", ...style }}>
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: status === "404" ? "#8C959F" : status === "error" || status === "500" ? "#CF222E" : "#0969DA",
          marginBottom: 16,
        }}
      >
        {status}
      </div>
      {title && <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1F2328", margin: "0 0 8px 0" }}>{title}</h2>}
      {subTitle && <p style={{ fontSize: 14, color: "#59636E", margin: "0 0 24px 0" }}>{subTitle}</p>}
      {extra && <div>{extra}</div>}
    </div>
  );
}

export const App = {
  useApp: () => ({
    message,
    modal: {
      confirm: ({ title, content, onOk, onCancel }: any) => {
        const text = [title, content].filter(Boolean).map(String).join("\n");
        if (typeof window !== "undefined" && window.confirm(text || "Xác nhận thực hiện?")) {
          onOk?.();
        } else {
          onCancel?.();
        }
      },
    },
  }),
};

// ==========================================
// 1. BUTTON
// ==========================================
export type ButtonProps = {
  children?: ReactNode;
  type?: "primary" | "default" | "dashed" | "link" | "text";
  danger?: boolean;
  ghost?: boolean;
  size?: "small" | "middle" | "large";
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  className?: string;
  htmlType?: "button" | "submit" | "reset";
  block?: boolean;
  key?: any;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    type = "default",
    danger,
    ghost,
    size = "middle",
    icon,
    loading,
    disabled,
    onClick,
    style,
    className,
    htmlType = "button",
    block,
  },
  ref
) {
  const variant = danger
    ? "danger"
    : type === "primary"
    ? "primary"
    : type === "text" || type === "link"
    ? "invisible"
    : "default";

  const pSize = size === "small" ? "small" : size === "large" ? "large" : "medium";

  return (
    <PrimerButton
      ref={ref}
      variant={variant}
      size={pSize}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      type={htmlType}
      leadingVisual={icon as any}
      style={{
        ...(block ? { width: "100%", display: "flex", justifyContent: "center" } : {}),
        ...style,
      }}
      className={className}
    >
      {children}
    </PrimerButton>
  );
});

// ==========================================
// 2. INPUT & FORM CONTROLS
// ==========================================
export type InputProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: "small" | "middle" | "large";
  prefix?: ReactNode;
  suffix?: ReactNode;
  allowClear?: boolean;
  style?: CSSProperties;
  className?: string;
  type?: string;
  autoComplete?: string;
  autoCapitalize?: string;
  autoFocus?: boolean;
  inputMode?: any;
  onPressEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
  [key: string]: any;
};

export type TextAreaProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  maxLength?: number;
  style?: CSSProperties;
  className?: string;
  autoFocus?: boolean;
  [key: string]: any;
};

export const Input: React.FC<InputProps> & {
  TextArea: React.FC<TextAreaProps>;
  Password: React.FC<any>;
  Search: React.FC<any>;
} = Object.assign(
  React.forwardRef<HTMLInputElement, InputProps>(function Input(
    {
      value,
      defaultValue,
      onChange,
      placeholder,
      disabled,
      size = "middle",
      prefix,
      suffix,
      allowClear,
      style,
      className,
      type = "text",
      autoComplete,
      autoCapitalize,
      autoFocus,
      inputMode,
      onPressEnter,
      onKeyDown,
      id,
      ...rest
    },
    ref
  ) {
    const controlled = value !== undefined;
    return (
      <span style={{ display: "inline-flex", width: style?.width ?? "100%", ...style }} className={className}>
        <PrimerTextInput
          ref={ref}
          id={id}
          block
          type={type}
          size={size === "small" ? "small" : size === "large" ? "large" : "medium"}
          {...(controlled ? { value: value ?? "" } : { defaultValue })}
          onChange={onChange}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") onPressEnter?.(e);
            onKeyDown?.(e);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          inputMode={inputMode}
          leadingVisual={prefix as any}
          trailingVisual={suffix as any}
          trailingAction={
            allowClear && controlled && value ? (
              <PrimerTextInput.Action
                icon={XCircleFillIcon}
                aria-label="Xóa"
                onClick={() => onChange?.({ target: { value: "" } } as any)}
              />
            ) : undefined
          }
          {...rest}
        />
      </span>
    );
  }),
  {
    TextArea: function TextArea({ value, defaultValue, onChange, placeholder, disabled, rows = 3, style, className, autoSize: _autoSize, ...rest }: TextAreaProps) {
      const controlled = value !== undefined;
      return (
        <PrimerTextarea
          block
          resize="vertical"
          rows={rows}
          {...(controlled ? { value: value ?? "" } : { defaultValue })}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          style={style}
          {...rest}
        />
      );
    },
    Password: function Password(props: any) {
      return <Input {...props} type="password" />;
    },
    Search: function Search({ onSearch, ...props }: any) {
      return (
        <Input
          {...props}
          prefix={<SearchIcon size={14} />}
          onPressEnter={(e: any) => onSearch?.(e.target.value)}
        />
      );
    },
  }
);

export type InputNumberProps<T extends number | string = number> = {
  value?: T | null;
  defaultValue?: T | null;
  onChange?: (value: any) => void;
  min?: number;
  max?: number;
  step?: number;
  formatter?: (value: any) => string;
  parser?: (displayValue: any) => any;
  placeholder?: string;
  size?: "small" | "middle" | "large";
  style?: CSSProperties;
  disabled?: boolean;
  className?: string;
  prefix?: ReactNode;
  addonAfter?: ReactNode;
  addonBefore?: ReactNode;
  precision?: number;
  [key: string]: any;
};

export function InputNumber({
  value,
  defaultValue,
  onChange,
  formatter,
  parser,
  placeholder,
  size = "middle",
  style,
  disabled,
  className,
  prefix,
  addonBefore,
  addonAfter,
}: InputNumberProps) {
  const rawVal = value ?? defaultValue ?? "";
  const displayVal = formatter ? formatter(rawVal) : rawVal;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (parser) {
      onChange?.(parser(raw));
    } else {
      const n = Number(raw);
      onChange?.(isNaN(n) ? raw : n);
    }
  };

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6, width: style?.width ?? "100%", ...style }}
      className={className}
    >
      {addonBefore}
      <PrimerTextInput
        block
        inputMode="decimal"
        value={String(displayVal)}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        size={size === "small" ? "small" : size === "large" ? "large" : "medium"}
        leadingVisual={prefix as any}
      />
      {addonAfter}
    </span>
  );
}

// ==========================================
// 3. SELECT
// ==========================================
export type SelectOption = {
  label: ReactNode;
  value?: any;
  disabled?: boolean;
  options?: SelectOption[];
  [key: string]: any;
};

export type SelectProps<ValueType = any> = {
  options?: (SelectOption | string | number)[];
  value?: ValueType;
  defaultValue?: ValueType;
  onChange?: (value: any, option?: any) => void;
  placeholder?: ReactNode;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  allowClear?: boolean;
  size?: "small" | "middle" | "large";
  mode?: "multiple" | "tags";
  showSearch?: boolean;
  filterOption?: boolean | ((inputValue: string, option?: any) => boolean);
  loading?: boolean;
  children?: ReactNode;
  [key: string]: any;
};

const foldText = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

type FlatOption = { val: any; label: ReactNode; disabled?: boolean; group?: string; raw: any };

function flattenOptions(options: (SelectOption | string | number)[]): FlatOption[] {
  const out: FlatOption[] = [];
  const push = (opt: any, group?: string) => {
    const isObj = typeof opt === "object" && opt !== null;
    const val = isObj ? ("value" in opt ? opt.value : opt.label) : opt;
    const label = isObj && "label" in opt ? opt.label : val;
    out.push({ val, label, disabled: isObj ? opt.disabled : false, group, raw: opt });
  };
  options.forEach((opt: any, i: number) => {
    if (typeof opt === "object" && opt !== null && Array.isArray(opt.options)) {
      const g = String(typeof opt.label === "string" ? opt.label : i);
      opt.options.forEach((sub: any) => push(sub, g));
    } else {
      push(opt);
    }
  });
  return out;
}

/** Chọn một/nhiều giá trị bằng Primer SelectPanel (có ô tìm kiếm, nhóm, chọn nhiều). */
export function Select({
  options = [],
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  style,
  className,
  allowClear,
  size = "middle",
  mode,
  filterOption,
}: SelectProps) {
  const isMulti = mode === "multiple" || mode === "tags";
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [inner, setInner] = useState<any>(defaultValue);
  const current = value !== undefined ? value : inner;

  const flat = useMemo(() => flattenOptions(options), [options]);
  const selVals: any[] = isMulti
    ? Array.isArray(current)
      ? current
      : []
    : current === undefined || current === null || current === ""
    ? []
    : [current];

  const labelOf = (o: FlatOption) => (typeof o.label === "string" ? o.label : String(o.val));
  const toItem = (o: FlatOption): any => ({
    id: o.val,
    ...(typeof o.label === "string" ? { text: o.label } : { children: o.label }),
    disabled: o.disabled,
    groupId: o.group,
  });

  const needle = foldText(filter.trim());
  const visible = flat.filter((o) => {
    if (!needle) return true;
    if (typeof filterOption === "function") return filterOption(filter, o.raw);
    return foldText(labelOf(o)).includes(needle);
  });
  const groups = Array.from(new Set(flat.map((o) => o.group).filter(Boolean))) as string[];
  const selectedFlat = flat.filter((o) => selVals.includes(o.val));
  const text =
    selectedFlat.length === 0
      ? ""
      : isMulti
      ? selectedFlat.length <= 2
        ? selectedFlat.map(labelOf).join(", ")
        : selectedFlat.length + " đã chọn"
      : labelOf(selectedFlat[0]);

  const emit = (v: any, rawOpt: any) => {
    setInner(v);
    onChange?.(v, rawOpt);
  };

  const panelProps: any = isMulti
    ? {
        selected: selectedFlat.map(toItem),
        onSelectedChange: (items: any[]) => {
          const ids = items.map((i) => i.id);
          emit(
            ids,
            flat.filter((o) => ids.includes(o.val)).map((o) => o.raw)
          );
        },
      }
    : {
        selected: selectedFlat[0] ? toItem(selectedFlat[0]) : undefined,
        onSelectedChange: (item: any) => {
          if (item) emit(item.id, flat.find((o) => o.val === item.id)?.raw);
          else if (allowClear) emit(undefined, undefined);
          setOpen(false);
          setFilter("");
        },
      };

  return (
    <span style={{ display: "inline-block", width: style?.width ?? "100%", ...style }} className={className}>
      <SelectPanel
        open={open}
        onOpenChange={(o: boolean) => {
          setOpen(o);
          if (!o) setFilter("");
        }}
        items={visible.map(toItem)}
        {...(groups.length
          ? { groupMetadata: groups.map((g) => ({ groupId: g, header: { title: g } })) as any }
          : {})}
        {...panelProps}
        filterValue={filter}
        onFilterChange={(v: string) => setFilter(v)}
        placeholder="Tìm kiếm..."
        inputLabel="Tìm kiếm"
        width="medium"
        renderAnchor={(anchor: any) => {
          const { children: _anchorChildren, ...anchorProps } = anchor;
          return (
            <PrimerButton
              {...anchorProps}
              block
              size={size === "small" ? "small" : size === "large" ? "large" : "medium"}
              disabled={disabled}
              trailingAction={TriangleDownIcon}
              alignContent="start"
            >
              <span
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: text ? undefined : "var(--fgColor-muted, #59636E)",
                }}
              >
                {text || (typeof placeholder === "string" ? placeholder : "Chọn...")}
              </span>
            </PrimerButton>
          );
        }}
      />
    </span>
  );
}

// ==========================================
// 4. CHECKBOX & RADIO
// ==========================================
export type CheckboxProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: any) => void;
  disabled?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  [key: string]: any;
};

export type CheckboxOptionType = {
  label: ReactNode;
  value: any;
  disabled?: boolean;
  onChange?: (e: any) => void;
};

export type CheckboxGroupProps = {
  options?: (string | number | CheckboxOptionType)[];
  value?: any[];
  defaultValue?: any[];
  onChange?: (checkedValues: any[]) => void;
  disabled?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  [key: string]: any;
};

export const Checkbox: React.FC<CheckboxProps> & {
  Group: React.FC<CheckboxGroupProps>;
} = Object.assign(
  function Checkbox({ checked, defaultChecked, onChange, disabled, children, style, className }: CheckboxProps) {
    return (
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          ...style,
        }}
        className={className}
      >
        <PrimerCheckbox
          {...(checked !== undefined ? { checked } : { defaultChecked })}
          disabled={disabled}
          onChange={onChange}
        />
        {children}
      </label>
    );
  },
  {
    Group: function CheckboxGroup({ options = [], value, defaultValue, onChange, disabled, children, style, className }: CheckboxGroupProps) {
      const currentVal = value !== undefined ? value || [] : defaultValue || [];
      const handleChange = (optVal: any, checked: boolean) => {
        const next = checked ? [...currentVal, optVal] : currentVal.filter((v: any) => v !== optVal);
        onChange?.(next);
      };

      if (options && options.length > 0) {
        return (
          <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 16, ...style }} className={className}>
            {options.map((opt: any) => {
              const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
              const optLabel = typeof opt === "object" && opt !== null ? opt.label : opt;
              const optDisabled = disabled || (typeof opt === "object" ? opt.disabled : false);
              return (
                <label
                  key={String(optVal)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: optDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  <PrimerCheckbox
                    checked={currentVal.includes(optVal)}
                    disabled={optDisabled}
                    onChange={(e) => handleChange(optVal, e.target.checked)}
                  />
                  <span>{optLabel}</span>
                </label>
              );
            })}
          </div>
        );
      }
      return (
        <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 16, ...style }} className={className}>
          {children}
        </div>
      );
    },
  }
);

export type RadioGroupProps = {
  options?: (string | number | { label: ReactNode; value: any; disabled?: boolean })[];
  value?: any;
  defaultValue?: any;
  onChange?: (e: any) => void;
  disabled?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  size?: "small" | "middle" | "large";
  optionType?: "default" | "button" | string;
  buttonStyle?: "outline" | "solid";
  [key: string]: any;
};

const RadioCtx = createContext<{
  name: string;
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
} | null>(null);

export const Radio: React.FC<any> & { Group: React.FC<RadioGroupProps> } = Object.assign(
  function Radio({ checked, onChange, value, children, disabled }: any) {
    const ctx = useContext(RadioCtx);
    const isChecked = ctx ? ctx.value === value : checked;
    const isDisabled = disabled || ctx?.disabled;
    return (
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      >
        <PrimerRadio
          name={ctx?.name ?? "radio"}
          value={String(value ?? "")}
          checked={Boolean(isChecked)}
          disabled={isDisabled}
          onChange={(e: any) => {
            ctx?.onChange(value);
            onChange?.(e);
          }}
        />
        {children}
      </label>
    );
  },
  {
    Group: function RadioGroup({ options, value, defaultValue, onChange, disabled, children, style, className, optionType, size }: RadioGroupProps) {
      const name = useId();
      const [inner, setInner] = useState<any>(defaultValue);
      const current = value !== undefined ? value : inner;
      const set = (v: any) => {
        setInner(v);
        onChange?.({ target: { value: v } });
      };

      if (options && options.length > 0 && optionType === "button") {
        return (
          <Segmented
            options={options.map((o: any) =>
              typeof o === "object" && o !== null
                ? { label: o.label, value: o.value, disabled: o.disabled }
                : { label: String(o), value: o }
            )}
            value={current}
            onChange={set}
            size={size}
            style={style}
            className={className}
          />
        );
      }

      return (
        <RadioCtx.Provider value={{ name, value: current, onChange: set, disabled }}>
          <div
            role="radiogroup"
            style={{ display: "inline-flex", flexWrap: "wrap", gap: 16, ...style }}
            className={className}
          >
            {options && options.length > 0
              ? options.map((opt: any) => {
                  const optVal = typeof opt === "object" && opt !== null ? opt.value : opt;
                  const optLabel = typeof opt === "object" && opt !== null ? opt.label : opt;
                  const optDisabled = typeof opt === "object" && opt !== null ? opt.disabled : false;
                  return (
                    <Radio key={String(optVal)} value={optVal} disabled={optDisabled}>
                      {optLabel}
                    </Radio>
                  );
                })
              : children}
          </div>
        </RadioCtx.Provider>
      );
    },
  }
);

// ==========================================
// 5. DATE & TIME PICKERS
// ==========================================
export type DatePickerProps = {
  value?: any;
  defaultValue?: any;
  onChange?: (date: Dayjs | null, dateString?: string) => void;
  disabledDate?: (currentDate: Dayjs) => boolean;
  picker?: "date" | "month" | "year" | "time" | "quarter" | "week";
  format?: string;
  style?: CSSProperties;
  allowClear?: boolean;
  placeholder?: string;
  showTime?: boolean | object;
  className?: string;
  [key: string]: any;
};

export type DateRangePickerProps = {
  value?: [Dayjs | null, Dayjs | null] | null;
  defaultValue?: [Dayjs | null, Dayjs | null];
  onChange?: (dates: [Dayjs | null, Dayjs | null] | null, dateStrings: [string, string]) => void;
  disabledDate?: (currentDate: Dayjs) => boolean;
  format?: string;
  style?: CSSProperties;
  allowClear?: boolean;
  className?: string;
  [key: string]: any;
};

export const DatePicker: React.FC<DatePickerProps> & { RangePicker: React.FC<DateRangePickerProps> } = Object.assign(
  function DatePicker({ value, defaultValue, onChange, picker = "date", style, className, placeholder, disabled }: DatePickerProps) {
    const isMonth = picker === "month";
    const fmt = isMonth ? "YYYY-MM" : "YYYY-MM-DD";
    const dateStr = value ? dayjs(value).format(fmt) : defaultValue ? dayjs(defaultValue).format(fmt) : "";
    return (
      <span style={{ display: "inline-flex", width: style?.width, ...style }} className={className}>
        <PrimerTextInput
          block={style?.width !== undefined}
          type={isMonth ? "month" : "date"}
          value={dateStr}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) onChange?.(null, "");
            else onChange?.(dayjs(val), val);
          }}
        />
      </span>
    );
  },
  {
    RangePicker: function DateRangePicker({ value, onChange, style, className }: DateRangePickerProps) {
      const start = value?.[0] ? dayjs(value[0]).format("YYYY-MM-DD") : "";
      const end = value?.[1] ? dayjs(value[1]).format("YYYY-MM-DD") : "";
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }} className={className}>
          <PrimerTextInput
            type="date"
            value={start}
            onChange={(e) => {
              const s = e.target.value ? dayjs(e.target.value) : null;
              onChange?.([s, value?.[1] ?? null], [e.target.value, end]);
            }}
          />
          <span>–</span>
          <PrimerTextInput
            type="date"
            value={end}
            onChange={(e) => {
              const endObj = e.target.value ? dayjs(e.target.value) : null;
              onChange?.([value?.[0] ?? null, endObj], [start, e.target.value]);
            }}
          />
        </span>
      );
    },
  }
);

export type TimePickerProps = {
  value?: any;
  defaultValue?: any;
  onChange?: (time: Dayjs | null, timeString?: string) => void;
  format?: string;
  minuteStep?: number;
  hourStep?: number;
  style?: CSSProperties;
  allowClear?: boolean;
  className?: string;
  [key: string]: any;
};

export type TimeRangePickerProps = {
  value?: [Dayjs | null, Dayjs | null] | null;
  defaultValue?: [Dayjs | null, Dayjs | null];
  onChange?: (times: [Dayjs | null, Dayjs | null] | null, timeStrings: [string, string]) => void;
  format?: string;
  minuteStep?: number;
  hourStep?: number;
  style?: CSSProperties;
  allowClear?: boolean;
  className?: string;
  [key: string]: any;
};

export const TimePicker: React.FC<TimePickerProps> & { RangePicker: React.FC<TimeRangePickerProps> } = Object.assign(
  function TimePicker({ value, onChange, style, className, disabled }: TimePickerProps) {
    const timeStr = value ? dayjs(value).format("HH:mm") : "";
    return (
      <span style={{ display: "inline-flex", ...style }} className={className}>
        <PrimerTextInput
          type="time"
          value={timeStr}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            onChange?.(val ? dayjs("2000-01-01 " + val) : null, val);
          }}
        />
      </span>
    );
  },
  {
    RangePicker: function TimeRangePicker({ value, onChange, style, className }: TimeRangePickerProps) {
      const start = value?.[0] ? dayjs(value[0]).format("HH:mm") : "";
      const end = value?.[1] ? dayjs(value[1]).format("HH:mm") : "";
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }} className={className}>
          <PrimerTextInput
            type="time"
            value={start}
            onChange={(e) => {
              const s = e.target.value ? dayjs("2000-01-01 " + e.target.value) : null;
              onChange?.([s, value?.[1] ?? null], [e.target.value, end]);
            }}
          />
          <span>–</span>
          <PrimerTextInput
            type="time"
            value={end}
            onChange={(e) => {
              const endObj = e.target.value ? dayjs("2000-01-01 " + e.target.value) : null;
              onChange?.([value?.[0] ?? null, endObj], [start, e.target.value]);
            }}
          />
        </span>
      );
    },
  }
);

// ==========================================
// 6. FORM & VALIDATION
// ==========================================
export type RuleObject = {
  required?: boolean;
  message?: ReactNode;
  min?: number;
  max?: number;
  len?: number;
  type?: string;
  pattern?: RegExp;
  validator?: (rule: any, value: any, callback?: any) => Promise<void | any> | void;
  [key: string]: any;
};
export type RuleRender = (form: FormInstance) => RuleObject;
export type Rule = RuleObject | RuleRender;

export type FormInstance<Values = any> = {
  values: Record<string, any>;
  errors: Record<string, string>;
  getFieldValue: (name: string) => any;
  getFieldsValue: (nameList?: any) => any;
  setFieldValue: (name: string, value: any) => void;
  setFieldsValue: (newVals: Partial<Values> | Record<string, any>) => void;
  resetFields: (fields?: string[]) => void;
  validateFields: (nameList?: any) => Promise<Values>;
  submit: () => void;
  notify: () => void;
  rules: Record<string, any[]>;
  listeners: Set<() => void>;
  subscribe: (listener: () => void) => () => void;
};

const FormContext = createContext<{ form: FormInstance; layout?: string } | null>(null);

function createFormStore(initialValues: Record<string, any> = {}): FormInstance {
  const store: FormInstance = {
    values: { ...initialValues },
    errors: {},
    rules: {},
    listeners: new Set(),
    getFieldValue(name: string) {
      return store.values[name];
    },
    getFieldsValue(nameList?: any) {
      if (Array.isArray(nameList)) {
        const res: Record<string, any> = {};
        for (const k of nameList) {
          res[k] = store.values[k];
        }
        return res;
      }
      return { ...store.values };
    },
    setFieldValue(name: string, value: any) {
      store.values[name] = value;
      delete store.errors[name];
      store.notify();
    },
    setFieldsValue(newVals: Record<string, any>) {
      store.values = { ...store.values, ...newVals };
      store.notify();
    },
    resetFields() {
      store.values = { ...initialValues };
      store.errors = {};
      store.notify();
    },
    async validateFields(nameList?: any) {
      store.errors = {};
      let hasError = false;
      const targetEntries = Array.isArray(nameList)
        ? Object.entries(store.rules).filter(([k]) => nameList.includes(k))
        : Object.entries(store.rules);

      for (const [name, rules] of targetEntries) {
        const val = store.values[name];
        for (const rule of rules) {
          const r = typeof rule === "function" ? rule(store) : rule;
          if (
            r.required &&
            (val === undefined ||
              val === null ||
              val === "" ||
              (Array.isArray(val) && val.length === 0))
          ) {
            store.errors[name] = r.message || `${name} là bắt buộc`;
            hasError = true;
            break;
          }
          if (r.min && typeof val === "string" && val.length < r.min) {
            store.errors[name] = r.message || `Tối thiểu ${r.min} ký tự`;
            hasError = true;
            break;
          }
          if (r.validator) {
            try {
              await r.validator(r, val);
            } catch (err: any) {
              store.errors[name] = err?.message || (typeof err === "string" ? err : "Giá trị không hợp lệ");
              hasError = true;
              break;
            }
          }
        }
      }
      store.notify();
      if (hasError) {
        throw new Error("Vui lòng kiểm tra lại thông tin");
      }
      return { ...store.values };
    },
    submit() {
      // triggered via form onFinish
    },
    notify() {
      for (const l of store.listeners) {
        l();
      }
    },
    subscribe(listener: () => void) {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
  };
  return store;
}

export type FormProps<Values = any> = {
  form?: FormInstance<Values>;
  initialValues?: Partial<Values> | Record<string, any>;
  onFinish?: (values: any) => void | Promise<void>;
  layout?: "vertical" | "horizontal" | "inline";
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  [key: string]: any;
};

export function Form<Values = any>({
  form: customForm,
  initialValues,
  onFinish,
  layout = "vertical",
  children,
  style,
  className,
}: FormProps<Values>) {
  const [internalForm] = useState(() => customForm || createFormStore(initialValues));
  const activeForm = customForm || internalForm;

  useEffect(() => {
    if (initialValues) {
      activeForm.setFieldsValue(initialValues);
    }
  }, [initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const vals = await activeForm.validateFields();
      onFinish?.(vals);
    } catch (err) {
      // Form errors set in store
    }
  };

  activeForm.submit = () => {
    void activeForm.validateFields().then((vals: any) => onFinish?.(vals)).catch(() => {});
  };

  return (
    <FormContext.Provider value={{ form: activeForm, layout }}>
      <form onSubmit={handleSubmit} style={style}>
        {children}
      </form>
    </FormContext.Provider>
  );
}

Form.useForm = () => {
  const formRef = useRef<FormInstance | null>(null);
  if (!formRef.current) {
    formRef.current = createFormStore();
  }
  return [formRef.current];
};

Form.useWatch = (name: string, formInstance?: FormInstance) => {
  const ctx = useContext(FormContext);
  const active = formInstance || ctx?.form;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    return active.subscribe(() => setTick((t) => t + 1));
  }, [active]);

  return active ? active.getFieldValue(name) : undefined;
};

export type FormItemProps = {
  name?: string | number | (string | number)[];
  label?: ReactNode;
  rules?: Rule[];
  valuePropName?: string;
  children?: ReactNode | ((form: FormInstance) => ReactNode);
  initialValue?: any;
  style?: CSSProperties;
  className?: string;
  extra?: ReactNode;
  dependencies?: any[];
  noStyle?: boolean;
  hidden?: boolean;
  tooltip?: ReactNode;
  [key: string]: any;
};

Form.Item = function FormItem({
  name,
  label,
  rules,
  valuePropName = "value",
  children,
  initialValue,
  style,
  extra,
  noStyle,
  hidden,
}: FormItemProps) {
  const ctx = useContext(FormContext);
  const form = ctx?.form;
  const [, setTick] = useState(0);

  const fieldName = name !== undefined ? (Array.isArray(name) ? name.join(".") : String(name)) : undefined;

  useEffect(() => {
    if (!form || !fieldName) return;
    if (rules) {
      form.rules[fieldName] = rules;
    }
    if (initialValue !== undefined && form.getFieldValue(fieldName) === undefined) {
      form.values[fieldName] = initialValue;
    }
    return form.subscribe(() => setTick((t) => t + 1));
  }, [form, fieldName, rules, initialValue]);

  if (hidden) return null;

  if (typeof children === "function") {
    const dummy = form || createFormStore();
    return <>{(children as (form: FormInstance) => ReactNode)(dummy)}</>;
  }

  const value = fieldName && form ? form.getFieldValue(fieldName) : undefined;
  const error = fieldName && form ? form.errors[fieldName] : undefined;

  let childNode = children;
  if (fieldName && form && React.isValidElement(children)) {
    const childProps: any = {
      [valuePropName]: value !== undefined ? value : (children.props as any)[valuePropName],
      onChange: (e: any) => {
        const val = e && e.target ? (valuePropName === "checked" ? e.target.checked : e.target.value) : e;
        form.setFieldValue(fieldName, val);
        (children.props as any).onChange?.(e);
      },
    };
    childNode = React.cloneElement(children, childProps);
  }

  if (noStyle) {
    return <>{childNode}</>;
  }

  const isRequired = rules?.some((r: any) => typeof r === "object" && r?.required);

  return (
    <FormControl required={Boolean(isRequired)} style={{ marginBottom: 14, ...style }}>
      {label && <FormControl.Label>{label}</FormControl.Label>}
      {childNode}
      {error && <FormControl.Validation variant="error">{String(error)}</FormControl.Validation>}
      {extra && <FormControl.Caption>{extra}</FormControl.Caption>}
    </FormControl>
  );
};

// ==========================================
// 7. LAYOUT & CONTAINERS (Card, Row, Col, Space)
// ==========================================
export function Card({ title, extra, children, style, size = "default", className }: any) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #D0D7DE",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(31, 35, 40, 0.04)",
        padding: size === "small" ? "12px 14px" : "16px 20px",
        ...style,
      }}
      className={`primer-card ${className || ""}`}
    >
      {(title || extra) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 10,
            marginBottom: 12,
            borderBottom: "1px solid #EAEFF2",
          }}
        >
          {title && <div style={{ fontWeight: 600, fontSize: 14, color: "#1F2328" }}>{title}</div>}
          {extra && <div>{extra}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

const RowContext = createContext<{ gutter?: number }>({});

export function Row({ gutter = 0, justify, align, children, style, className }: any) {
  const g = Array.isArray(gutter) ? gutter[0] : gutter;
  return (
    <RowContext.Provider value={{ gutter: g }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          marginLeft: g ? -g / 2 : undefined,
          marginRight: g ? -g / 2 : undefined,
          justifyContent: justify,
          alignItems: align,
          ...style,
        }}
        className={className}
      >
        {children}
      </div>
    </RowContext.Provider>
  );
}

export function Col({ span, xs, sm, md, lg, xl, flex, children, style, className }: any) {
  const { gutter } = useContext(RowContext);
  const s = span ?? lg ?? md ?? sm ?? xs;
  const flexBasis = flex ? flex : s ? `${(s / 24) * 100}%` : "100%";
  const maxWidth = flex ? undefined : s ? `${(s / 24) * 100}%` : "100%";
  return (
    <div
      style={{
        flex: flex ? (typeof flex === "number" ? `${flex} ${flex} auto` : flex) : `0 0 ${flexBasis}`,
        maxWidth,
        paddingLeft: gutter ? gutter / 2 : undefined,
        paddingRight: gutter ? gutter / 2 : undefined,
        boxSizing: "border-box",
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  );
}

export type SpaceProps = {
  direction?: "horizontal" | "vertical";
  size?: number | "small" | "middle" | "large" | [number, number];
  wrap?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  align?: "start" | "end" | "center" | "baseline";
  split?: ReactNode;
  [key: string]: any;
};

export const Space: React.FC<SpaceProps> & {
  Compact: React.FC<{ block?: boolean; size?: "small" | "middle" | "large"; children?: ReactNode; style?: CSSProperties; className?: string }>;
} = Object.assign(
  function Space({ direction = "horizontal", size = 8, wrap, children, style, className }: SpaceProps) {
    const gap = typeof size === "number" ? size : size === "small" ? 4 : size === "large" ? 16 : 8;
    return (
      <div
        style={{
          display: "inline-flex",
          flexDirection: direction === "vertical" ? "column" : "row",
          flexWrap: wrap ? "wrap" : "nowrap",
          gap,
          alignItems: "center",
          ...style,
        }}
        className={className}
      >
        {children}
      </div>
    );
  },
  {
    Compact: function Compact({ block, children, style, className }: any) {
      return (
        <div
          style={{
            display: block ? "flex" : "inline-flex",
            width: block ? "100%" : undefined,
            alignItems: "center",
            ...style,
          }}
          className={className}
        >
          {children}
        </div>
      );
    },
  }
);

export function Divider({ style, orientation, children }: any) {
  if (children) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0", color: "#59636E", fontSize: 13, ...style }}>
        <span style={{ fontWeight: 600 }}>{children}</span>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid #D0D7DE", margin: 0 }} />
      </div>
    );
  }
  return <hr style={{ border: 0, borderTop: "1px solid #D0D7DE", margin: "16px 0", ...style }} />;
}

// ==========================================
// 8. TABS & SEGMENTED
// ==========================================
export type TabItem = {
  key: string;
  label: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  [key: string]: any;
};

export type TabsProps = {
  items?: TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (activeKey: string) => void;
  style?: CSSProperties;
  className?: string;
  type?: "line" | "card";
  size?: "small" | "middle" | "large";
  [key: string]: any;
};

export function Tabs({ items = [], activeKey, defaultActiveKey, onChange, style, className }: TabsProps) {
  const [cur, setCur] = useState(activeKey || defaultActiveKey || items[0]?.key);
  const current = activeKey !== undefined ? activeKey : cur;

  const activeItem = items.find((it: any) => it.key === current) || items[0];

  return (
    <div style={style} className={className}>
      <div style={{ marginBottom: 16 }}>
        <UnderlineNav aria-label="Tabs">
          {items.map((it: any) => (
            <UnderlineNav.Item
              key={it.key}
              as="button"
              type="button"
              aria-current={it.key === current ? "page" : undefined}
              disabled={it.disabled}
              onSelect={(e: any) => {
                e?.preventDefault?.();
                setCur(it.key);
                onChange?.(it.key);
              }}
            >
              {it.label}
            </UnderlineNav.Item>
          ))}
        </UnderlineNav>
      </div>
      <div>{activeItem?.children}</div>
    </div>
  );
}

export type SegmentedOption<T = any> = {
  label: ReactNode;
  value: T;
  disabled?: boolean;
  icon?: ReactNode;
};

export type SegmentedProps<T = any> = {
  options: (T | SegmentedOption<T>)[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  size?: "small" | "middle" | "large";
  block?: boolean;
  style?: CSSProperties;
  className?: string;
};

export function Segmented<T = any>({
  options = [],
  value,
  defaultValue,
  onChange,
  disabled,
  size = "middle",
  block,
  style,
  className,
}: SegmentedProps<T>) {
  const currentVal = value !== undefined ? value : defaultValue;
  const items = options.map((opt: any) => {
    const isObj = typeof opt === "object" && opt !== null && "value" in opt;
    return {
      val: isObj ? opt.value : opt,
      lbl: isObj && "label" in opt ? opt.label : opt,
      disabled: disabled || (isObj && opt.disabled),
    };
  });
  return (
    <div style={{ display: block ? "block" : "inline-block", ...style }} className={className}>
      <SegmentedControl
        aria-label="Chọn"
        size={size === "small" ? "small" : "medium"}
        fullWidth={block}
        onChange={(i: number) => onChange?.(items[i].val)}
      >
        {items.map((it: any) => (
          <SegmentedControl.Button key={String(it.val)} selected={it.val === currentVal} disabled={it.disabled}>
            {it.lbl}
          </SegmentedControl.Button>
        ))}
      </SegmentedControl>
    </div>
  );
}

// ==========================================
// 9. TAG, BADGE, ALERT, EMPTY, SKELETON
// ==========================================
export type TagProps = {
  color?: string;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  icon?: ReactNode;
  closable?: boolean;
  onClose?: (e: React.MouseEvent<HTMLElement>) => void;
  [key: string]: any;
};

export type CheckableTagProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  [key: string]: any;
};

const TAG_VARIANTS: Record<string, string> = {
  green: "success",
  success: "success",
  blue: "accent",
  processing: "accent",
  gold: "attention",
  warning: "attention",
  orange: "severe",
  red: "danger",
  error: "danger",
  danger: "danger",
  purple: "done",
  cyan: "accent",
  default: "secondary",
};

export const Tag: React.FC<TagProps> & { CheckableTag: React.FC<CheckableTagProps> } = Object.assign(
  function Tag({ color, children, icon, style, className }: TagProps) {
    const key = typeof color === "string" ? color.toLowerCase() : "";
    const variant = TAG_VARIANTS[key];
    const hex = !variant && typeof color === "string" && color.startsWith("#") ? color : undefined;
    return (
      <Label
        variant={(variant as any) ?? "secondary"}
        className={className}
        style={{
          marginRight: 4,
          gap: 4,
          ...(hex ? { color: hex, borderColor: `${hex}66`, background: `${hex}14` } : {}),
          ...style,
        }}
      >
        {icon}
        {children}
      </Label>
    );
  },
  {
    CheckableTag: function CheckableTag({ checked, onChange, children, style, className }: CheckableTagProps) {
      return (
        <span
          role="button"
          tabIndex={0}
          onClick={() => onChange?.(!checked)}
          style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
            background: checked ? "#0969DA" : "#F6F8FA",
            border: checked ? "1px solid #0969DA" : "1px solid #D0D7DE",
            color: checked ? "#FFFFFF" : "#59636E",
            cursor: "pointer",
            marginRight: 6,
            marginBottom: 6,
            userSelect: "none",
            ...style,
          }}
          className={className}
        >
          {children}
        </span>
      );
    },
  }
);

export function Badge({ count, dot, children, color, style }: any) {
  if (!children && !dot && count !== undefined) {
    return (
      <span style={style}>
        <CounterLabel scheme="primary">{count}</CounterLabel>
      </span>
    );
  }
  return (
    <span style={{ position: "relative", display: "inline-flex", ...style }}>
      {children}
      {dot ? (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color || "var(--fgColor-danger, #CF222E)",
          }}
        />
      ) : count !== undefined ? (
        <span style={{ position: "absolute", top: -8, right: -10 }}>
          <CounterLabel scheme="primary">{count}</CounterLabel>
        </span>
      ) : null}
    </span>
  );
}

export function Alert({ type = "info", message, description, showIcon, style }: any) {
  const variant = type === "error" ? "danger" : type === "warning" ? "warning" : type === "success" ? "success" : "default";
  const Icon = type === "error" || type === "warning" ? AlertIcon : type === "success" ? CheckCircleFillIcon : InfoIcon;
  return (
    <Flash variant={variant} style={style}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {showIcon && (
          <span style={{ marginTop: 1, display: "inline-flex" }}>
            <Icon size={16} />
          </span>
        )}
        <div style={{ flex: 1 }}>
          {message && <div style={{ fontWeight: 600 }}>{message}</div>}
          {description && <div style={{ fontSize: 12, marginTop: 2 }}>{description}</div>}
        </div>
      </div>
    </Flash>
  );
}

export const Empty: React.FC<any> & { PRESENTED_IMAGE_SIMPLE: string } = Object.assign(
  function Empty({ description = "Không có dữ liệu", style }: any) {
    return (
      <Blankslate spacious style={style}>
        <Blankslate.Visual>
          <InboxIcon size="medium" />
        </Blankslate.Visual>
        <Blankslate.Description>{description}</Blankslate.Description>
      </Blankslate>
    );
  },
  {
    PRESENTED_IMAGE_SIMPLE: "PRESENTED_IMAGE_SIMPLE",
  }
);

export function Skeleton({ style }: any) {
  return (
    <div style={{ padding: "16px 0", ...style }}>
      <SkeletonText lines={3} />
    </div>
  );
}

export function Spin({ size = "default", style }: any) {
  const pSize = size === "small" ? "small" : size === "large" ? "large" : "medium";
  return (
    <div style={{ display: "inline-grid", placeItems: "center", padding: 12, ...style }}>
      <Spinner size={pSize} />
    </div>
  );
}

// ==========================================
// 10. MODAL & POPCONFIRM
// ==========================================
export function Modal({
  open,
  title,
  subtitle,
  onClose,
  onCancel,
  onOk,
  okText,
  cancelText,
  confirmLoading,
  width,
  style,
  footer,
  destroyOnClose,
  destroyOnHidden,
  children,
}: any) {
  const handleClose = onClose || onCancel || (() => {});
  const modalWidth =
    typeof width === "number"
      ? `${width}px`
      : typeof width === "string"
      ? width
      : "large";

  return (
    <PrimerModal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={handleClose}
      onOk={onOk}
      okText={okText}
      cancelText={cancelText}
      confirmLoading={confirmLoading}
      width={modalWidth}
      footer={footer}
    >
      {children}
    </PrimerModal>
  );
}

export function Popconfirm({
  title,
  description,
  onConfirm,
  onCancel,
  okText = "Đồng ý",
  cancelText = "Hủy",
  children,
  okButtonProps,
}: any) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {React.isValidElement(children)
        ? React.cloneElement(children as any, {
            onClick: (e: React.MouseEvent) => {
              e?.stopPropagation?.();
              setOpen(true);
            },
          })
        : children}
      {open && (
        <ConfirmationDialog
          title={title}
          cancelButtonContent={cancelText}
          confirmButtonContent={okText}
          confirmButtonType={okButtonProps?.danger ? "danger" : "primary"}
          onClose={(gesture: string) => {
            setOpen(false);
            if (gesture === "confirm") onConfirm?.();
            else onCancel?.();
          }}
        >
          {description}
        </ConfirmationDialog>
      )}
    </>
  );
}

// ==========================================
// 11. TABLE (Alias to PrimerGrid)
// ==========================================
export type TableProps<T extends object = any> = Omit<PrimerGridProps<T>, "columns"> & {
  columns?: ColumnsType<T>;
  rowClassName?: string | ((record: T, index: number) => string);
  expandable?: {
    expandedRowRender?: (record: T, index: number, indent: number, expanded: boolean) => ReactNode;
    defaultExpandAllRows?: boolean;
    rowExpandable?: (record: T) => boolean;
    [key: string]: any;
  };
  footer?: () => ReactNode;
  [key: string]: any;
};

export type TableSummaryProps = {
  fixed?: boolean | "top" | "bottom";
  children?: ReactNode;
};

export function Table<T extends object>(props: TableProps<T>) {
  return <PrimerGrid {...props} columns={props.columns ?? []} />;
}

Table.Summary = Object.assign(
  function Summary({ children }: TableSummaryProps) {
    return <div style={{ borderTop: "1px solid #D0D7DE", background: "#F6F8FA", padding: "6px 12px" }}>{children}</div>;
  },
  {
    Row: function SummaryRow({ children }: { children?: ReactNode }) {
      return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>{children}</div>;
    },
    Cell: function SummaryCell({
      colSpan,
      align,
      children,
    }: {
      index?: number;
      colSpan?: number;
      align?: "left" | "right" | "center";
      children?: ReactNode;
    }) {
      return (
        <div style={{ textAlign: align, flex: colSpan ? colSpan : 1 }}>
          {children}
        </div>
      );
    },
  }
);

export function Dropdown({ menu, children }: any) {
  const items: any[] = menu?.items ?? [];
  return (
    <PrimerActionMenu>
      <PrimerActionMenu.Anchor>
        <span style={{ display: "inline-flex" }}>{children}</span>
      </PrimerActionMenu.Anchor>
      <PrimerActionMenu.Overlay width="small" align="end">
        <ActionList>
          {items.map((item: any, idx: number) =>
            item.type === "divider" ? (
              <ActionList.Divider key={item.key ?? idx} />
            ) : (
              <ActionList.Item
                key={item.key ?? idx}
                variant={item.danger ? "danger" : "default"}
                disabled={item.disabled}
                onSelect={() => {
                  item.onClick?.({ key: item.key });
                  menu?.onClick?.({ key: item.key });
                }}
              >
                {item.icon && <ActionList.LeadingVisual>{item.icon}</ActionList.LeadingVisual>}
                {item.label}
              </ActionList.Item>
            )
          )}
        </ActionList>
      </PrimerActionMenu.Overlay>
    </PrimerActionMenu>
  );
}



// ==========================================
// 12. DESCRIPTIONS, LIST, STEPS, ETC.
// ==========================================
export const Descriptions: React.FC<any> & { Item: React.FC<any> } = Object.assign(
  function Descriptions({ title, column = 2, children, style }: any) {
    return (
      <div style={style}>
        {title && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{title}</div>}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${column}, 1fr)`, gap: 12 }}>
          {children}
        </div>
      </div>
    );
  },
  {
    Item: function Item({ label, children }: any) {
      return (
        <div>
          <div style={{ fontSize: 12, color: "#59636E" }}>{label}</div>
          <div style={{ fontSize: 13, color: "#1F2328", marginTop: 2 }}>{children}</div>
        </div>
      );
    },
  }
);

export type ListProps<T = any> = {
  dataSource?: readonly T[];
  renderItem?: (item: T, index: number) => ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  bordered?: boolean;
  size?: "small" | "default" | "large";
  style?: CSSProperties;
  className?: string;
  locale?: { emptyText?: ReactNode };
  children?: ReactNode;
  [key: string]: any;
};

export const List: (<T = any>(props: ListProps<T>) => React.ReactElement | null) & {
  Item: React.FC<any> & { Meta: React.FC<any> };
} = Object.assign(
  function List<T = any>({ dataSource = [], renderItem, children, bordered, style, className, locale }: ListProps<T>) {
    if (dataSource.length === 0 && !children && locale?.emptyText) {
      return (
        <div
          style={{ padding: "16px 0", color: "var(--fgColor-muted, #59636E)", fontSize: 13, textAlign: "center", ...style }}
          className={className}
        >
          {locale.emptyText}
        </div>
      );
    }
    return (
      <div
        style={{
          ...(bordered ? { border: "1px solid var(--borderColor-default, #D0D7DE)", borderRadius: 6 } : {}),
          ...style,
        }}
        className={className}
      >
        <ActionList showDividers>
          {dataSource.map((item: any, idx: number) => (
            <React.Fragment key={idx}>{renderItem?.(item, idx)}</React.Fragment>
          ))}
          {children}
        </ActionList>
      </div>
    );
  },
  {
    Item: Object.assign(
      function ListItem({ children, actions, style }: any) {
        return (
          <ActionList.Item>
            <div style={style}>{children}</div>
            {actions && actions.length > 0 && (
              <ActionList.TrailingVisual>
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                  {actions.map((act: any, idx: number) => (
                    <React.Fragment key={idx}>{act}</React.Fragment>
                  ))}
                </span>
              </ActionList.TrailingVisual>
            )}
          </ActionList.Item>
        );
      },
      {
        Meta: function ListMeta({ title, description, avatar }: any) {
          return (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {avatar}
              <div>
                {title && <div style={{ fontWeight: 600 }}>{title}</div>}
                {description && (
                  <div style={{ color: "var(--fgColor-muted, #59636E)", fontSize: 12 }}>{description}</div>
                )}
              </div>
            </div>
          );
        },
      }
    ),
  }
);

export function Steps({ current = 0, items = [], style }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
      {items.map((it: any, idx: number) => {
        const isDone = idx < current;
        const isCur = idx === current;
        return (
          <React.Fragment key={idx}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: isDone ? "#1A7F37" : isCur ? "#0969DA" : "#EAEFF2",
                  color: isDone || isCur ? "#fff" : "#59636E",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {isDone ? "✓" : idx + 1}
              </span>
              <span style={{ fontSize: 13, fontWeight: isCur ? 600 : 400, color: isCur ? "#0969DA" : "#59636E" }}>
                {it.title}
              </span>
            </div>
            {idx < items.length - 1 && (
              <span style={{ flex: 1, height: 1, background: isDone ? "#1A7F37" : "#D0D7DE", margin: "0 4px" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function Statistic({ title, value, prefix, suffix, style }: any) {
  return (
    <div style={style}>
      {title && <div style={{ fontSize: 12, color: "#59636E" }}>{title}</div>}
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1F2328", marginTop: 2 }}>
        {prefix} {value} {suffix}
      </div>
    </div>
  );
}

export function Switch({ checked, defaultChecked, onChange, disabled, style }: any) {
  const labelId = useId();
  return (
    <span style={{ display: "inline-flex", ...style }}>
      <span id={labelId} hidden>
        Bật/tắt
      </span>
      <PrimerToggleSwitch
        size="small"
        aria-labelledby={labelId}
        disabled={disabled}
        {...(checked !== undefined ? { checked: Boolean(checked) } : { defaultChecked })}
        onChange={(on: boolean) => onChange?.(on)}
      />
    </span>
  );
}

export function Tooltip({ title, children }: any) {
  if (typeof title !== "string" || !title) return <>{children}</>;
  return (
    <PrimerTooltip text={title} direction="n">
      <span tabIndex={0} style={{ display: "inline-flex" }}>
        {children}
      </span>
    </PrimerTooltip>
  );
}

export function ColorPicker({ value, onChange }: any) {
  return (
    <input
      type="color"
      value={value || "#1F6FEB"}
      onChange={(e) => onChange?.(e.target.value)}
      style={{ width: 32, height: 32, border: "1px solid #D0D7DE", borderRadius: 4, cursor: "pointer" }}
    />
  );
}

export function Timeline({ items = [], children }: any) {
  return (
    <PrimerTimeline>
      {items.map((it: any, idx: number) => (
        <PrimerTimeline.Item key={idx}>
          <PrimerTimeline.Badge>
            <DotFillIcon fill={it.color || undefined} />
          </PrimerTimeline.Badge>
          <PrimerTimeline.Body>{it.children}</PrimerTimeline.Body>
        </PrimerTimeline.Item>
      ))}
      {children}
    </PrimerTimeline>
  );
}

export function Collapse({ items = [] }: any) {
  return (
    <div>
      {items.map((it: any) => (
        <details key={it.key} style={{ border: "1px solid #D0D7DE", borderRadius: 6, marginBottom: 8, padding: 8 }}>
          <summary style={{ fontWeight: 600, cursor: "pointer" }}>{it.label}</summary>
          <div style={{ marginTop: 8 }}>{it.children}</div>
        </details>
      ))}
    </div>
  );
}

export function Popover({ content, title, children }: any) {
  const [open, setOpen] = useState(false);
  return (
    <AnchoredOverlay
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      align="end"
      renderAnchor={(anchor: any) => {
        if (React.isValidElement(children)) {
          const child = children as React.ReactElement<any>;
          return React.cloneElement(child, {
            ...anchor,
            onClick: (e: any) => {
              anchor.onClick?.(e);
              child.props?.onClick?.(e);
            },
          });
        }
        return (
          <span {...anchor} style={{ display: "inline-flex", verticalAlign: "middle" }}>
            {children}
          </span>
        );
      }}
      overlayProps={{ role: "dialog", "aria-label": typeof title === "string" ? title : "Hộp thoại" } as any}
    >
      <div style={{ padding: 12, minWidth: 220 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>}
        {content}
      </div>
    </AnchoredOverlay>
  );
}

export const Typography = {
  Title: function Title({ level = 4, children, style }: any) {
    const Tag = `h${level}` as any;
    return <Tag style={{ margin: 0, color: "#1F2328", ...style }}>{children}</Tag>;
  },
  Text: function Text({ children, style }: any) {
    return <span style={style}>{children}</span>;
  },
  Link: function LinkComp({ href, children, style }: any) {
    return (
      <a href={href} style={{ color: "#0969DA", ...style }}>
        {children}
      </a>
    );
  },
};
