import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Package,
  User,
  Wheat,
  IndianRupee,
  CheckCircle,
  XCircle,
  Truck,
  Box,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Home,
  Clock,
} from "lucide-react";

interface OrderRow {
  id: string;
  orderNumber?: string;
  consumer_id: string;
  farmer_id: string;
  crop_name: string;
  quantity: number;
  price_per_kg: number;
  total_price: number;
  status: string;
  created_at: string;
  consumer_name?: string;
  consumer_phone?: string;
  delivery_address?: string;
  payment_status?: string;
  rejection_reason?: string;
}

const FarmerOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const activeTrackingOrderRef = useRef<string | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

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
      console.warn("[FarmerOrders] MongoDB orders fetch failed, falling back to Supabase:", apiErr);
    }

    // Fallback: Supabase orders
    try {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("farmer_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        const consumerIds = [...new Set(data.map((o) => o.consumer_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", consumerIds);

        const nameMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));
        const phoneMap = new Map((profiles || []).map((p) => [p.id, p.phone]));

        setOrders(
          data.map((o) => ({
            ...o,
            crop_name: o.crop_name || "",
            price_per_kg: o.price_per_kg || 0,
            consumer_name: nameMap.get(o.consumer_id) || "Consumer",
            consumer_phone: phoneMap.get(o.consumer_id) || "",
          }))
        );
      }
    } catch (e) {
      console.error("[FarmerOrders] Supabase orders fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Real-time WebSocket synchronization
  useRealtimeSync("order", (event) => {
    if (event.action === "create") {
      const crop = event.data?.crop_name || event.data?.cropName || "produce";
      const qty = event.data?.quantity || "";
      const consumer = event.data?.consumer_name || "A consumer";
      toast.info(`🔔 New Order! ${consumer} requested ${qty} kg of ${crop}.`, {
        duration: 7000,
      });
      fetchOrders();
    } else if (event.action === "update") {
      fetchOrders();
    }
  });

  useEffect(() => {
    fetchOrders();

    // Supabase Realtime channel as secondary fallback
    const channel = supabase
      .channel("farmer-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopDeliveryTracking();
    };
  }, [fetchOrders]);

  // Visibility change: pause/resume GPS
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && activeTrackingOrderRef.current) {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      } else if (!document.hidden && activeTrackingOrderRef.current) {
        startGpsWatch(activeTrackingOrderRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const startGpsWatch = useCallback((orderId: string) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = Date.now();

        let speed = pos.coords.speed || 0;
        if (!speed && lastPosRef.current) {
          const dt = (now - lastPosRef.current.time) / 1000;
          if (dt > 0) {
            const R = 6371000;
            const dLat = ((lat - lastPosRef.current.lat) * Math.PI) / 180;
            const dLng = ((lng - lastPosRef.current.lng) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos((lastPosRef.current.lat * Math.PI) / 180) *
                Math.cos((lat * Math.PI) / 180) *
                Math.sin(dLng / 2) ** 2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            speed = dist / dt;
          }
        }

        lastPosRef.current = { lat, lng, time: now };

        // 1. Update GPS via Node.js API & WebSocket broadcast
        try {
          await api.put(`/orders/${orderId}/tracking`, {
            latitude: lat,
            longitude: lng,
            speed: Math.round(speed * 3.6), // km/h
          });
        } catch (e) {
          // ignore tracking stream errors
        }

        // 2. Supabase delivery_tracking fallback
        try {
          await supabase
            .from("delivery_tracking")
            .update({
              current_latitude: lat,
              current_longitude: lng,
              speed: Math.round(speed * 100) / 100,
              last_updated: new Date().toISOString(),
            } as any)
            .eq("order_id", orderId);
        } catch (e) {
          // ignore fallback
        }
      },
      (err) => {
        console.error("GPS error:", err);
        toast.error("Location access interrupted. Tracking paused.");
        stopDeliveryTracking();
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, []);

  const startDeliveryTracking = async (orderId: string) => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by this browser");
      return;
    }

    if (activeTrackingOrderRef.current === orderId) {
      toast.info("Live GPS tracking is already active for this order");
      return;
    }

    activeTrackingOrderRef.current = orderId;

    try {
      await supabase.from("delivery_tracking").upsert(
        {
          order_id: orderId,
          current_latitude: 0,
          current_longitude: 0,
        },
        { onConflict: "order_id" }
      );
    } catch (e) {
      // ignore
    }

    toast.success("📍 Live GPS tracking started! Streaming coordinates to consumer.");
    startGpsWatch(orderId);
  };

  const stopDeliveryTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (activeTrackingOrderRef.current) {
      activeTrackingOrderRef.current = null;
      lastPosRef.current = null;
      toast.info("Delivery GPS tracking stopped");
    }
  };

  const updateStatus = async (orderId: string, newStatus: string, reason?: string) => {
    setUpdatingOrderId(orderId);
    try {
      // 1. Primary update via Node.js backend
      const res = await api.put<any>(`/orders/${orderId}/status`, {
        status: newStatus,
        reason,
        note: `Status updated to ${newStatus} by farmer`,
      });

      if (res && (res.success || res.order)) {
        toast.success(`Order status updated to ${newStatus.replace(/_/g, " ")}`);

        if (newStatus === "out_for_delivery") {
          startDeliveryTracking(orderId);
        }

        if (newStatus === "delivered" || newStatus === "rejected") {
          stopDeliveryTracking();
        }

        await fetchOrders();
        return;
      }
    } catch (apiErr: any) {
      console.warn("[FarmerOrders] API status update note:", apiErr);
      const msg = apiErr.response?.data?.message || apiErr.message || "Failed to update status";
      toast.error(msg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleReject = (orderId: string) => {
    const reason = window.prompt("Reason for rejecting this order (optional):", "Produce temporarily unavailable");
    if (reason !== null) {
      updateStatus(orderId, "rejected", reason);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
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

  const renderActions = (order: OrderRow) => {
    const isUpdating = updatingOrderId === order.id;
    switch (order.status) {
      case "pending":
        return (
          <div className="flex gap-2">
            <Button size="sm" disabled={isUpdating} onClick={() => updateStatus(order.id, "accepted")}>
              {isUpdating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />} Accept
            </Button>
            <Button size="sm" variant="destructive" disabled={isUpdating} onClick={() => handleReject(order.id)}>
              {isUpdating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />} Reject
            </Button>
          </div>
        );
      case "accepted":
        return (
          <Button size="sm" disabled={isUpdating} onClick={() => updateStatus(order.id, "packed")}>
            {isUpdating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Box className="w-4 h-4 mr-1" />} Mark as Packed
          </Button>
        );
      case "packed":
        return (
          <Button size="sm" disabled={isUpdating} onClick={() => updateStatus(order.id, "out_for_delivery")}>
            {isUpdating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Truck className="w-4 h-4 mr-1" />} Start Delivery (GPS)
          </Button>
        );
      case "out_for_delivery":
        return (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" disabled={isUpdating} onClick={() => updateStatus(order.id, "delivered")}>
              {isUpdating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />} Mark Delivered
            </Button>
            {activeTrackingOrderRef.current === order.id ? (
              <Button size="sm" variant="outline" className="gap-1" onClick={stopDeliveryTracking}>
                <Navigation className="w-3.5 h-3.5 text-destructive" /> Stop GPS
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => startDeliveryTracking(order.id)}>
                <MapPin className="w-3.5 h-3.5 text-primary animate-pulse" /> Resume GPS
              </Button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Order Management</h1>
          <p className="text-muted-foreground text-sm">Real-time incoming orders and delivery tracking</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1 animate-pulse">
            {pendingCount} New Pending Order{pendingCount > 1 ? "s" : ""}
          </Badge>
        )}
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
            No incoming orders yet. When consumers place orders for your crops, they will appear here in real time.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card
              key={order.id}
              className={
                order.status === "pending"
                  ? "border-primary/60 shadow-md bg-primary/5"
                  : order.status === "out_for_delivery"
                  ? "border-amber-500/50 shadow-sm"
                  : ""
              }
            >
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Order #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    {activeTrackingOrderRef.current === order.id && (
                      <span className="flex items-center gap-1 text-[11px] sm:text-xs text-primary font-medium">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        Live GPS Active
                      </span>
                    )}
                    <Badge variant={getStatusBadgeVariant(order.status)} className="capitalize text-[10px] sm:text-xs">
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs sm:text-sm bg-muted/40 p-2.5 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{order.consumer_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wheat className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{order.crop_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{order.quantity} kg</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-bold text-foreground">₹{order.total_price}</span>
                  </div>
                </div>

                {/* Additional Delivery & Contact details */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-3 pt-1 border-t border-border/40">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-wrap">
                    {order.consumer_phone && (
                      <span className="flex items-center gap-1 text-foreground/80 font-medium">
                        <Phone className="w-3 h-3 text-muted-foreground" /> {order.consumer_phone}
                      </span>
                    )}
                    {order.delivery_address && (
                      <span className="flex items-center gap-1 text-foreground/80 line-clamp-1 max-w-md">
                        <Home className="w-3 h-3 text-muted-foreground shrink-0" /> {order.delivery_address}
                      </span>
                    )}
                  </div>
                  {order.rejection_reason && (
                    <span className="text-destructive font-medium text-xs">
                      Reason: {order.rejection_reason}
                    </span>
                  )}
                  <div className="w-full sm:w-auto flex justify-end">
                    {renderActions(order)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FarmerOrders;
