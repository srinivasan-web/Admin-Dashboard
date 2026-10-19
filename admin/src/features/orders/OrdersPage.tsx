import { OrderDetailPage } from "./OrderDetailPage";
import { OrdersList } from "./OrdersList";

export function OrdersPage({
  abandoned = false,
  orderId,
  canManage,
  onOpenOrder,
  onBack,
}: {
  abandoned?: boolean;
  orderId?: string;
  canManage: boolean;
  onOpenOrder: (id: string) => void;
  onBack: () => void;
}) {
  if (orderId)
    return (
      <OrderDetailPage id={orderId} canManage={canManage} onBack={onBack} />
    );
  return <OrdersList abandoned={abandoned} onView={onOpenOrder} />;
}
