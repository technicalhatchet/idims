/** Work order part line statuses — shared by desktop and mobile equipment UI. */

export const PART_STATUSES = [
  { value: 'needed', label: 'Needed', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'on_hand', label: 'On Hand', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200' },
  { value: 'ordered', label: 'Ordered', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'received', label: 'Received', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
  { value: 'upfront_50', label: '50% Upfront', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { value: 'phone_payment', label: 'Phone Payment', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
  { value: 'paid_not_installed', label: 'PdNI', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  { value: 'installed', label: 'Installed', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { value: 'not_installed', label: 'Not Installed', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
];

export const SHOP_STOCK_VENDOR_ID = 'Shop';

export function isShopStockVendor(vendor) {
  const key = (vendor || '').trim().toLowerCase();
  return key === 'shop' || key === 'shop stock' || key === 'shopstock';
}

export function isShopStockPart(part) {
  if (!part) return false;
  if (part.inventory_item_id) return true;
  return isShopStockVendor(part.vendor);
}

export function getPartTrackingFieldMeta(part) {
  if (isShopStockPart(part)) {
    return {
      label: 'Stock location',
      placeholder: 'Shelf, bin, or van location',
      uppercase: false,
    };
  }
  return {
    label: 'Tracking number',
    placeholder: 'Enter tracking number',
    uppercase: true,
  };
}
