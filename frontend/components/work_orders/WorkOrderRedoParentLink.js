import Link from 'next/link';
import { FaRedo } from 'react-icons/fa';

export default function WorkOrderRedoParentLink({ workOrder, variant = 'desktop' }) {
  if (!workOrder?.is_redo || !workOrder.parent_work_order_id || !workOrder.parent_order_number) {
    return null;
  }

  const isMobile = variant === 'mobile';
  const href = `/work_orders/${workOrder.parent_work_order_id}${isMobile ? '/mobile' : ''}`;

  return (
    <Link
      href={href}
      className={
        isMobile
          ? 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700'
          : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700'
      }
    >
      <FaRedo className="w-3 h-3" />
      Redo of {workOrder.parent_order_number}
    </Link>
  );
}
