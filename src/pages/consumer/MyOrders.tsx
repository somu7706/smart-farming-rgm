import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface OrderRow {
  id: string;
  crop_name: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  farmer_name?: string;
}

const MyOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("consumer_id", user.id)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    const farmerIds = [...new Set(data.map((o) => o.farmer_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", farmerIds);

    const nameMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

    setOrders(
      data.map((o) => ({
        id: o.id,
        crop_name: (o as any).crop_name || "",
        quantity: o.quantity,
        total_price: o.total_price,
        status: o.status,
        created_at: o.created_at,
        farmer_name: nameMap.get(o.farmer_id) || "Unknown",
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("consumer-orders")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `consumer_id=eq.${user?.id}` },
        (payload: any) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;
          if (newStatus !== oldStatus) {
            if (newStatus === "out_for_delivery") {
              toast.info("🚚 Your order is out for delivery!", { duration: 6000 });
            } else if (newStatus === "delivered") {
              toast.success("✅ Your order has been delivered!", { duration: 6000 });
            }
          }
          fetchOrders();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `consumer_id=eq.${user?.id}` },
        () => fetchOrders()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "secondary" as const;
      case "accepted": return "default" as const;
      case "packed": return "outline" as const;
      case "out_for_delivery": return "default" as const;
      case "delivered": return "default" as const;
      case "rejected": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">My Orders</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No orders yet. Start shopping from the Agri Market!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/consumer/orders/${order.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Order #{order.id.slice(0, 8)}</p>
                  <Badge variant={getStatusColor(order.status)}>
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{order.crop_name} • {order.quantity} kg</span>
                  <span className="font-semibold text-foreground">₹{order.total_price}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Farmer: {order.farmer_name}</span>
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOrders;
