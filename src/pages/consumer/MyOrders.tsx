import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Wheat, IndianRupee, Clock, Truck, ChevronRight, Loader2 } from "lucide-react";

interface OrderRow {
  id: string;
  orderNumber?: string;
  crop_name: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  farmer_name?: string;
  delivery_address?: string;
}

const MyOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ success: boolean; orders: OrderRow[] }>("/orders");
      if (res && res.orders) {
        setOrders(res.orders);
        setLoading(false);
        return;
      }
    } catch (apiErr) {
      console.warn("[MyOrders] API orders fetch failed, falling back to Supabase:", apiErr);
    }

    // Fallback: Supabase orders
    try {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("consumer_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
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
            farmer_name: nameMap.get(o.farmer_id) || "Local Farmer",
          }))
        );
      }
    } catch (e) {
      console.error("[MyOrders] Supabase orders fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Real-time synchronization
  useRealtimeSync("order", (event) => {
    if (event.action === "update" && event.data) {
      const status = event.data.status;
      const crop = event.data.crop_name || "produce";
      if (status === "accepted") {
        toast.success(`✅ Great news! Your order for ${crop} was accepted by the farmer.`, { duration: 6000 });
      } else if (status === "packed") {
        toast.info(`📦 Your ${crop} is packed and ready for dispatch.`, { duration: 6000 });
      } else if (status === "out_for_delivery") {
        toast.info(`🚚 Your order for ${crop} is out for delivery! Track it live now.`, { duration: 7000 });
      } else if (status === "delivered") {
        toast.success(`🎉 Your order for ${crop} has been delivered!`, { duration: 7000 });
      } else if (status === "rejected") {
        toast.error(`❌ Your order for ${crop} was declined by the farmer.`);
      }
    }
    fetchOrders();
  });

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("consumer-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary" as const;
      case "accepted":
        return "default" as const;
      case "packed":
        return "outline" as const;
      case "out_for_delivery":
        return "default" as const;
      case "delivered":
        return "default" as const;
      case "rejected":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
          <p className="text-muted-foreground text-sm">Track your farm-to-table produce orders</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-base font-medium text-foreground">No orders placed yet</p>
            <p className="text-sm text-muted-foreground mt-1">Browse fresh seasonal crops from registered farmers in the Agri Market!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:shadow-md transition-all border hover:border-primary/50 group"
              onClick={() => navigate(`/consumer/orders/${order.id}`)}
            >
              <CardContent className="py-3.5 sm:py-4 px-3.5 sm:px-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Order #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    {order.status === "out_for_delivery" && (
                      <span className="flex items-center gap-1 text-[11px] sm:text-xs text-primary font-medium">
                        <Truck className="w-3.5 h-3.5 animate-bounce" /> Live Tracking
                      </span>
                    )}
                    <Badge variant={getStatusColor(order.status)} className="capitalize text-[10px] sm:text-xs">
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Wheat className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground">{order.crop_name}</span>
                    <span className="text-muted-foreground text-xs">• {order.quantity} kg</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-bold text-foreground text-sm sm:text-base">₹{order.total_price}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between sm:items-center text-xs text-muted-foreground mt-2 pt-2 border-t gap-1">
                  <span className="truncate">Farmer: <strong className="text-foreground/80 font-medium">{order.farmer_name}</strong></span>
                  <span className="flex items-center text-primary group-hover:translate-x-0.5 transition-transform font-medium shrink-0">
                    View Tracking Details <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </span>
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
