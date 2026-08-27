'use client';

import {
  FaBolt,
  FaBurn,
  FaCog,
  FaDoorOpen,
  FaFan,
  FaFire,
  FaFlask,
  FaIceCream,
  FaSnowflake,
  FaTint,
  FaWind,
  FaWrench,
} from 'react-icons/fa';

const ID_ICON_MAP = {
  airflow: FaWind,
  dryer_airflow: FaWind,
  heat_pump_airflow: FaFan,
  defrost_system: FaSnowflake,
  sealed_system: FaFlask,
  door_seal: FaDoorOpen,
  electrical_supply: FaBolt,
  water_dispenser: FaTint,
  ice_maker: FaIceCream,
  control_board: FaCog,
  ignition: FaFire,
  gas_valve: FaBurn,
  heat_safety: FaBolt,
  motor: FaCog,
  washer_drive: FaCog,
  drain_pump: FaTint,
  fill_valve: FaTint,
  suspension: FaWrench,
  noise_vibration: FaWrench,
};

const LABEL_PATTERNS = [
  { pattern: /airflow|vent/i, icon: FaWind },
  { pattern: /defrost|frost/i, icon: FaSnowflake },
  { pattern: /sealed|refrigerant|compressor/i, icon: FaFlask },
  { pattern: /door|gasket|seal/i, icon: FaDoorOpen },
  { pattern: /electrical|supply|voltage/i, icon: FaBolt },
  { pattern: /water|dispenser|drain|fill/i, icon: FaTint },
  { pattern: /ice/i, icon: FaIceCream },
  { pattern: /ignition|igniter|flame/i, icon: FaFire },
  { pattern: /gas valve/i, icon: FaBurn },
  { pattern: /motor|drive|tumble/i, icon: FaCog },
  { pattern: /control|sensor|board/i, icon: FaCog },
  { pattern: /fan/i, icon: FaFan },
];

export function getCategoryIconComponent(categoryId, categoryLabel = '') {
  if (categoryId && ID_ICON_MAP[categoryId]) {
    return ID_ICON_MAP[categoryId];
  }

  const label = categoryLabel || categoryId || '';
  for (const { pattern, icon } of LABEL_PATTERNS) {
    if (pattern.test(label)) return icon;
  }

  return FaWrench;
}

export default function SolomonCategoryIcon({
  categoryId,
  categoryLabel,
  className = '',
  size = 20,
}) {
  const Icon = getCategoryIconComponent(categoryId, categoryLabel);
  return <Icon className={className} size={size} aria-hidden />;
}
