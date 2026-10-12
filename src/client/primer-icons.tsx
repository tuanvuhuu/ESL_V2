"use client";

import React from "react";
import {
  AlertIcon,
  AppsIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  ArrowSwitchIcon,
  BookIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckCircleFillIcon,
  CheckIcon,
  ChecklistIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleSlashIcon,
  ClockIcon,
  CommentIcon,
  CopyIcon,
  CreditCardIcon,
  DeviceMobileIcon,
  DownloadIcon,
  FileIcon,
  GearIcon,
  GraphIcon,
  HomeIcon,
  KeyIcon,
  ListUnorderedIcon,
  PencilIcon,
  PeopleIcon,
  PersonIcon,
  PlusIcon,
  ReplyIcon,
  SearchIcon,
  SignOutIcon,
  TrashIcon,
} from "@primer/octicons-react";

type IconProps = {
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  spin?: boolean;
};

function wrap(IconComponent: React.ComponentType<any>) {
  return function PrimerIconWrapper({ style, className, onClick, spin }: IconProps) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          verticalAlign: "middle",
          lineHeight: 1,
          ...style,
          ...(spin ? { animation: "primerSpin 1s linear infinite" } : {}),
        }}
        className={className}
        onClick={onClick}
      >
        <IconComponent
          size={style?.fontSize ? Number(style.fontSize) : 16}
          style={{ display: "block" }}
        />
      </span>
    );
  };
}

export const PlusOutlined = wrap(PlusIcon);
export const SearchOutlined = wrap(SearchIcon);
export const DeleteOutlined = wrap(TrashIcon);
export const EditOutlined = wrap(PencilIcon);
export const CopyOutlined = wrap(CopyIcon);
export const CheckOutlined = wrap(CheckIcon);
export const CheckCircleFilled = wrap(CheckCircleFillIcon);
export const CheckSquareOutlined = wrap(ChecklistIcon);
export const DownOutlined = wrap(ChevronDownIcon);
export const LeftOutlined = wrap(ChevronLeftIcon);
export const RightOutlined = wrap(ChevronRightIcon);
export const ArrowLeftOutlined = wrap(ArrowLeftIcon);
export const DownloadOutlined = wrap(DownloadIcon);
export const PrinterOutlined = wrap(FileIcon);
export const DollarOutlined = wrap(CreditCardIcon);
export const WalletOutlined = wrap(CreditCardIcon);
export const FileTextOutlined = wrap(FileIcon);
export const AccountBookOutlined = wrap(ArchiveIcon);
export const BarChartOutlined = wrap(GraphIcon);
export const CalendarOutlined = wrap(CalendarIcon);
export const ScheduleOutlined = wrap(ClockIcon);
export const ClockCircleOutlined = wrap(ClockIcon);
export const BookOutlined = wrap(BookIcon);
export const ReadOutlined = wrap(BookIcon);
export const TeamOutlined = wrap(PeopleIcon);
export const UserOutlined = wrap(PersonIcon);
export const UsergroupAddOutlined = wrap(PeopleIcon);
export const SolutionOutlined = wrap(BriefcaseIcon);
export const PhoneOutlined = wrap(DeviceMobileIcon);
export const SettingOutlined = wrap(GearIcon);
export const ControlOutlined = wrap(GearIcon);
export const HomeOutlined = wrap(HomeIcon);
export const KeyOutlined = wrap(KeyIcon);
export const LogoutOutlined = wrap(SignOutIcon);
export const MessageOutlined = wrap(CommentIcon);
export const StopOutlined = wrap(CircleSlashIcon);
export const SwapOutlined = wrap(ArrowSwitchIcon);
export const AppstoreOutlined = wrap(AppsIcon);
export const RollbackOutlined = wrap(ReplyIcon);
export const UnorderedListOutlined = wrap(ListUnorderedIcon);
export const ExclamationCircleOutlined = wrap(AlertIcon);
export const AlertOutlined = wrap(AlertIcon);
export const InfoCircleOutlined = wrap(AlertIcon);
export const QuestionCircleOutlined = wrap(AlertIcon);
