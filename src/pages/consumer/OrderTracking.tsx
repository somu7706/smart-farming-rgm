import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Package, Truck, Box, ShoppingCart, MapPin, Phone, MessageCircle } from "lucide-react";
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
  crop_name: string;
  quantity: number;
  price_per_kg: number;
  total_price: number;
  status: string;
  created_at: string;
  farmer_name: string;
  farmer_id: string;
  farmer_phone?: string;
}

const OrderTracking = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<{ current_latitude: number; current_longitude: number } | null>(null);
  const [consumerLocation, setConsumerLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get consumer location
  useEffect(() => {
    if (!user) return;
    const saveConsumerLocation = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("latitude, longitude")
        .eq("id", user.id)
        .single();

      if (profile?.latitude && profile?.longitude) {
        setConsumerLocation({ lat: Number(profile.latitude), lng: Number(profile.longitude) });
        return;
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            setConsumerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            await supabase.from("profiles").update({ latitude: pos.coords.latitude, longitude: pos.coords.longitude } as any).eq("id", user.id);
          },
          () => {
            setConsumerLocation({ lat: 28.6139, lng: 77.209 });
            toast.info("Using default location. Update your profile for accurate tracking.");
          }
        );
      } else {
        setConsumerLocation({ lat: 28.6139, lng: 77.209 });
      }
    };
    saveConsumerLocation();
  }, [user]);

  const fetchOrder = async () => {
    if (!orderId || !user) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("consumer_id", user.id)
      .single();

    if (!data) { setLoading(false); return; }

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
      farmer_name: profile?.full_name || "Unknown",
      farmer_id: data.farmer_id,
      farmer_phone: profile?.phone || undefined,
    });
    setLoading(false);

    if (data.status === "out_for_delivery") {
      const { data: trackData } = await supabase
        .from("delivery_tracking")
        .select("current_latitude, current_longitude")
        .eq("order_id", orderId)
        .single();
      if (trackData) setTracking(trackData);
    }
  };

  useEffect(() => {
    fetchOrder();

    const orderChannel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (newStatus === "out_for_delivery") toast.info("🚚 Your order is out for delivery!");
          else if (newStatus === "delivered") toast.success("✅ Your order has been delivered!");
          fetchOrder();
        }
      )
      .subscribe();

    const trackChannel = supabase
      .channel(`tracking-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_tracking" },
        (payload: any) => {
          if (payload.new?.order_id === orderId) {
            setTracking({
              current_latitude: payload.new.current_latitude,
              current_longitude: payload.new.current_longitude,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(trackChannel);
    };
  }, [orderId, user]);

  if (loading) return <p className="text-muted-foreground p-6">Loading order...</p>;
  if (!order) return <p className="text-destructive p-6">Order not found.</p>;

  const currentStepIdx = order.status === "rejected" ? -1 : STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">Order Tracking</h1>

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
            <Badge variant={order.status === "rejected" ? "destructive" : "default"}>
              {order.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Crop</span><span>{order.crop_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Farmer</span><span>{order.farmer_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span>{order.quantity} kg</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Price/kg</span><span>₹{order.price_per_kg}</span></div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>₹{order.total_price}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Placed</span><span>{new Date(order.created_at).toLocaleString()}</span></div>
        </CardContent>
      </Card>

      {/* Contact Farmer */}
      {order.status !== "delivered" && order.status !== "rejected" && order.farmer_phone && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => window.open(`tel:${order.farmer_phone}`)}>
            <Phone className="w-4 h-4" /> Call Farmer
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => window.open(`sms:${order.farmer_phone}`)}>
            <MessageCircle className="w-4 h-4" /> Message Farmer
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
            <div className="flex items-center justify-between">
              {STEPS.map((step, idx) => {
                const isCompleted = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div key={step.key} className="flex flex-col items-center relative flex-1">
                    {idx > 0 && (
                      <div
                        className={`absolute top-4 -left-1/2 w-full h-0.5 ${idx <= currentStepIdx ? "bg-primary" : "bg-border"}`}
                        style={{ zIndex: 0 }}
                      />
                    )}
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    } ${isCurrent ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs mt-2 text-center ${isCompleted ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Messages */}
      {order.status === "packed" && (
        <Card>
          <CardContent className="py-6 text-center">
            <Box className="w-10 h-10 mx-auto mb-3 text-primary" />
            <p className="text-foreground font-medium">Order Packed</p>
            <p className="text-sm text-muted-foreground">Waiting for dispatch. Live map will appear once the farmer starts delivery.</p>
          </CardContent>
        </Card>
      )}

      {order.status === "delivered" && (
        <Card>
          <CardContent className="py-6 text-center">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-primary" />
            <p className="text-foreground font-medium text-lg">Order Delivered Successfully!</p>
            <p className="text-sm text-muted-foreground">Your order has been delivered. Thank you!</p>
          </CardContent>
        </Card>
      )}

      {/* Live Map */}
      {order.status === "out_for_delivery" && consumerLocation && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary animate-pulse" />
              <CardTitle className="text-lg">Live Delivery Tracking</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <LiveTrackingMap
              orderId={order.id}
              consumerLat={consumerLocation.lat}
              consumerLng={consumerLocation.lng}
              initialFarmerLat={tracking?.current_latitude || 0}
              initialFarmerLng={tracking?.current_longitude || 0}
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
