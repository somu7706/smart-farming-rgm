import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Circle,
  Package,
  Truck,
  Box,
  ShoppingCart,
  MapPin,
  Phone,
  MessageCircle,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import LiveTrackingMap from "@/components/LiveTrackingMap";

const STEPS = [
  { key: "pending", label: "Order Placed", icon: ShoppingCart },
  { key: "accepted", label: "Accepted", icon: CheckCircle },
  { key: "packed", label: "Packed", icon: Box },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
];

interface OrderDetail {
  id: string;
  orderNumber?: string;
  crop_name: string;
  quantity: number;
  price_per_kg: number;
  total_price: number;
  status: string;
  created_at: string;
  farmer_name: string;
  farmer_id: string;
  farmer_phone?: string;
  delivery_address?: string;
  rejection_reason?: string;
  tracking?: {
    currentLatitude?: number;
    currentLongitude?: number;
    speed?: number;
  };
}

const OrderTracking = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [consumerLocation, setConsumerLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get consumer location from Profile or Geolocation
  useEffect(() => {
    if (!user) return;
    const saveConsumerLocation = async () => {
      try {
        const prof = await api.get<any>("/profile");
        if (prof?.latitude && prof?.longitude) {
          setConsumerLocation({ lat: Number(prof.latitude), lng: Number(prof.longitude) });
          return;
        }
      } catch (e) {
        // ignore profile error
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setConsumerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {
            setConsumerLocation({ lat: 16.5062, lng: 80.648 }); // Andhra Pradesh center fallback
          }
        );
      } else {
        setConsumerLocation({ lat: 16.5062, lng: 80.648 });
      }
    };
    saveConsumerLocation();
  }, [user]);

  const fetchOrder = useCallback(async () => {
    if (!orderId || !user) return;
    try {
      const res = await api.get<{ success: boolean; order: OrderDetail }>(`/orders/${orderId}`);
      if (res && res.order) {
        setOrder(res.order);
        setLoading(false);
        return;
      }
    } catch (apiErr) {
      console.warn("[OrderTracking] API fetch failed, trying Supabase:", apiErr);
    }

    // Fallback: Supabase orders
    try {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", data.farmer_id)
          .single();

        setOrder({
          id: data.id,
          crop_name: data.crop_name || "",
          quantity: data.quantity,
          price_per_kg: data.price_per_kg || 0,
          total_price: data.total_price,
          status: data.status,
          created_at: data.created_at,
          farmer_name: profile?.full_name || "Verified Farmer",
          farmer_id: data.farmer_id,
          farmer_phone: profile?.phone || undefined,
        });
      }
    } catch (e) {
      console.error("[OrderTracking] Supabase fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  // Real-time synchronization
  useRealtimeSync("order", (event) => {
    if (event.id === orderId || event.data?.id === orderId) {
      if (event.data?.status && event.data?.status !== order?.status) {
        const newStatus = event.data.status;
        if (newStatus === "out_for_delivery") {
          toast.info("🚚 Your order is out for delivery! Driver location is streaming live.");
        } else if (newStatus === "delivered") {
          toast.success("✅ Your order has been delivered! Enjoy your farm fresh crop.");
        }
      }
      fetchOrder();
    }
  });

  useEffect(() => {
    fetchOrder();

    const orderChannel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => fetchOrder()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [fetchOrder, orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading tracking details...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Order Not Found</h2>
        <p className="text-muted-foreground text-sm">We could not locate this order in your account history.</p>
        <Button variant="outline" onClick={() => navigate("/consumer/orders")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Orders
        </Button>
      </div>
    );
  }

  const currentStepIdx = order.status === "rejected" ? -1 : STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/consumer/orders")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Orders
        </Button>
        <Badge variant={order.status === "rejected" ? "destructive" : "default"}>
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Rejection Alert */}
      {order.status === "rejected" && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 text-sm space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Order Declined
          </p>
          <p className="text-xs">
            Reason: {order.rejection_reason || "The farmer was unable to fulfill this request at this time."}
          </p>
        </div>
      )}

      {/* Order Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Order #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleString()}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Produce</span>
            <span className="font-medium text-foreground">{order.crop_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Farmer</span>
            <span className="font-medium text-foreground">{order.farmer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Quantity</span>
            <span className="text-foreground">{order.quantity} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price per kg</span>
            <span className="text-foreground">₹{order.price_per_kg}</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t text-base">
            <span>Total Price</span>
            <span className="text-primary">₹{order.total_price}</span>
          </div>
          {order.delivery_address && (
            <div className="flex flex-col sm:flex-row justify-between pt-1 border-t text-xs text-muted-foreground gap-1">
              <span className="shrink-0">Delivery Address</span>
              <span className="text-foreground/90 font-medium sm:text-right max-w-full sm:max-w-[320px]">
                {order.delivery_address}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Farmer */}
      {order.status !== "delivered" && order.status !== "rejected" && order.farmer_phone && (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:flex-1 gap-1.5 h-10"
            onClick={() => window.open(`tel:${order.farmer_phone}`)}
          >
            <Phone className="w-4 h-4 text-primary" /> Call Farmer
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:flex-1 gap-1.5 h-10"
            onClick={() => window.open(`sms:${order.farmer_phone}`)}
          >
            <MessageCircle className="w-4 h-4 text-primary" /> Message Farmer
          </Button>
        </div>
      )}

      {/* Step Tracker */}
      {order.status !== "rejected" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 space-y-6">
              {/* Vertical timeline connector */}
              <div className="absolute left-[35px] top-3 bottom-3 w-0.5 bg-muted" />

              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isCompleted = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={step.key} className="relative flex items-center gap-4">
                    <div
                      className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20"
                          : isCompleted
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isCurrent ? "text-primary font-bold" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-muted-foreground">Current active status</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live GPS Tracking Map for Out for Delivery */}
      {order.status === "out_for_delivery" && consumerLocation && (
        <Card className="overflow-hidden border-primary/50 shadow-md">
          <CardHeader className="bg-primary/5 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <Truck className="w-4 h-4 text-primary animate-pulse" /> Live Delivery Tracking
              </CardTitle>
              <Badge variant="outline" className="text-xs border-primary text-primary bg-primary/10">
                GPS Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[300px] sm:h-[380px] w-full min-w-0">
            <LiveTrackingMap
              orderId={order.id}
              consumerLat={consumerLocation.lat}
              consumerLng={consumerLocation.lng}
              initialFarmerLat={order.tracking?.currentLatitude || consumerLocation.lat + 0.02}
              initialFarmerLng={order.tracking?.currentLongitude || consumerLocation.lng + 0.02}
              farmerPhone={order.farmer_phone}
              farmerName={order.farmer_name}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrderTracking;
