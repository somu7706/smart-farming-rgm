import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSync, broadcastClientSync } from "@/hooks/useRealtimeSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  MapPin,
  Calendar,
  Package,
  TrendingUp,
  CheckCircle2,
  Home,
  Phone,
  Clock,
  Truck,
  Users,
  MessageSquare,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AddressSelector, SavedAddress } from "@/components/address/AddressSelector";

interface BulkOrder {
  id: string;
  bulk_order_number?: string;
  crop_name: string;
  quantity_required: number;
  unit: string;
  region: string | null;
  expected_delivery_start: string | null;
  expected_delivery_end: string | null;
  delivery_address?: string;
  delivery_address_snapshot?: any;
  status: string;
  created_at: string;
  total_committed: number;
  commitments?: Array<{
    id: string;
    farmerName: string;
    farmerPhone: string;
    farmerRegion: string;
    committedQuantity: number;
    status: string;
    notes?: string;
  }>;
}

const BulkOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<BulkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [cropName, setCropName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [region, setRegion] = useState("");
  const [deliveryStart, setDeliveryStart] = useState("");
  const [deliveryEnd, setDeliveryEnd] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    // 1. Fetch from authoritative Node.js / MongoDB API
    try {
      const res = await api.get<{ success: boolean; orders: BulkOrder[] }>("/bulk-orders");
      if (res && res.orders) {
        setOrders(res.orders);
        setLoading(false);
        return;
      }
    } catch (apiErr) {
      console.warn("[BulkOrders] API fetch failed, trying Supabase fallback:", apiErr);
    }

    // 2. Fallback to Supabase
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("bulk_orders")
        .select(`
          *,
          crop_demands (
            id,
            farmer_commitments (
              committed_quantity
            )
          )
        ` as any)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersData) {
        const processedOrders: BulkOrder[] = ordersData.map((order: any) => {
          const demand = order.crop_demands?.[0];
          const totalCommitted =
            demand?.farmer_commitments?.reduce(
              (acc: number, curr: any) => acc + (curr.committed_quantity || 0),
              0
            ) || 0;

          return {
            ...order,
            total_committed: totalCommitted,
          };
        });
        setOrders(processedOrders);
      }
    } catch (e) {
      console.error("[BulkOrders] Supabase orders fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Real-time synchronization across WebSocket, Supabase Broadcast, and BroadcastChannel
  useRealtimeSync("demand_supply", (event) => {
    console.log("[BulkOrders] Live sync event received:", event);
    fetchOrders();
  });

  useEffect(() => {
    fetchOrders();

    // High frequency 3-second live sync poll for production accuracy
    const interval = setInterval(() => {
      fetchOrders();
    }, 3000);

    const handleFocus = () => fetchOrders();
    window.addEventListener("focus", handleFocus);

    // Supabase fallback channel
    const channel = supabase
      .channel("bulk_orders_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "bulk_orders" }, () => fetchOrders())
      .subscribe();

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please log in as a consumer to create bulk orders");
      return;
    }

    if (!cropName.trim()) {
      toast.error("Please enter a crop name");
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error("Please enter a valid quantity greater than zero");
      return;
    }

    if (!deliveryStart || !deliveryEnd) {
      toast.error("Please select both expected delivery start and end dates");
      return;
    }

    const start = new Date(deliveryStart);
    const end = new Date(deliveryEnd);

    if (end < start) {
      toast.error("Expected delivery end date cannot be earlier than start date");
      return;
    }

    if (!selectedAddress) {
      toast.error("Please select or add a delivery address for fulfillment");
      return;
    }

    setSubmitting(true);

    const payload = {
      cropName: cropName.trim(),
      quantityRequired: qtyNum,
      unit,
      region: region.trim() || "Any",
      expectedDeliveryStart: deliveryStart,
      expectedDeliveryEnd: deliveryEnd,
      addressId: selectedAddress.id,
      deliveryAddress: selectedAddress.formattedAddress,
      deliveryAddressSnapshot: {
        addressId: selectedAddress.id,
        recipientName: selectedAddress.recipientName,
        phone: selectedAddress.phone,
        houseNo: selectedAddress.houseNo,
        street: selectedAddress.street,
        landmark: selectedAddress.landmark,
        city: selectedAddress.city,
        district: selectedAddress.district,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        label: selectedAddress.label,
        instructions: selectedAddress.instructions,
        formattedAddress: selectedAddress.formattedAddress,
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
      },
    };

    try {
      const res = await api.post<any>("/bulk-orders", payload);

      if (res && (res.success || res.order)) {
        toast.success(
          `Bulk Order #${res.order?.bulk_order_number || ""} created and published to Market Demand!`,
          { duration: 6000 }
        );
        setShowForm(false);
        resetForm();
        fetchOrders();

        // Broadcast to farmers and other active browser windows immediately
        broadcastClientSync({
          entity: "demand_supply",
          action: "create",
          data: res.order,
        });
      } else {
        toast.error(res?.message || "Failed to create bulk order");
      }
    } catch (err: any) {
      console.error("[BulkOrders] Error creating order:", err);
      const msg = err.response?.data?.message || err.message || "Failed to create bulk order";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCropName("");
    setQuantity("");
    setUnit("kg");
    setRegion("");
    setDeliveryStart("");
    setDeliveryEnd("");
  };

  const getPercentage = (committed: number, required: number) => {
    if (!required) return 0;
    return Math.min(Math.round((committed / required) * 100), 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fulfilled":
        return "bg-green-600 text-white";
      case "committed":
        return "bg-blue-600 text-white";
      case "open":
        return "bg-amber-600 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bulk Orders & Crop Demands</h1>
          <p className="text-sm text-muted-foreground">
            Place wholesale harvest demands and track farmer production commitments
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> New Bulk Order
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading bulk orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center space-y-3">
            <Package className="w-12 h-12 mx-auto text-muted-foreground opacity-30" />
            <h3 className="text-lg font-semibold text-foreground">No bulk orders placed yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create an institutional or wholesale bulk order. Registered farmers across India can view your demand and commit production directly to your doorstep.
            </p>
            <Button onClick={() => setShowForm(true)} variant="outline" className="mt-2">
              <Plus className="w-4 h-4 mr-1" /> Create Your First Bulk Order
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((order) => {
            const pct = getPercentage(order.total_committed, order.quantity_required);

            return (
              <Card
                key={order.id}
                className="overflow-hidden border-border/60 hover:border-primary/50 transition-colors shadow-sm"
              >
                <CardHeader className="pb-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <span>{order.crop_name}</span>
                        {order.bulk_order_number && (
                          <span className="text-xs font-mono text-muted-foreground font-normal">
                            #{order.bulk_order_number}
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center text-xs text-muted-foreground gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-primary" /> Preferred Production: {order.region || "Any Region"}
                      </div>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status === "open"
                        ? "Open for Farmers"
                        : order.status === "committed"
                        ? "Production In Progress"
                        : order.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3.5 pt-4">
                  {/* Quantity & Commitment Metric */}
                  <div className="grid grid-cols-2 gap-4 text-sm bg-muted/40 p-2.5 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Required Quantity</p>
                      <p className="font-bold text-foreground text-base">
                        {order.quantity_required.toLocaleString()} {order.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Committed by Farmers</p>
                      <p className="font-bold text-primary text-base">
                        {order.total_committed.toLocaleString()} {order.unit}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground">{pct}% Fulfilled</span>
                      <span className="text-muted-foreground">
                        Remaining: {Math.max(0, order.quantity_required - order.total_committed).toLocaleString()} {order.unit}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>

                  {/* Delivery Destination Snapshot */}
                  {order.delivery_address && (
                    <div className="bg-primary/5 border border-primary/15 rounded p-2.5 text-xs space-y-1">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Home className="w-3 h-3 text-primary" /> Delivery Destination
                      </span>
                      <p className="text-muted-foreground line-clamp-2">
                        {order.delivery_address}
                      </p>
                    </div>
                  )}

                  {/* Delivery Window */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      Window: {order.expected_delivery_start || "TBD"} to {order.expected_delivery_end || "TBD"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Farmer Commitments details with Direct Producer Calling */}
                  {order.commitments && order.commitments.length > 0 && (
                    <div className="pt-3 border-t text-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                          <Users className="w-3.5 h-3.5 text-primary" /> Farmer Commitments ({order.commitments.length})
                        </span>
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                          Direct Producer Connect
                        </Badge>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {order.commitments.map((c, i) => {
                          const cleanPhone = (c.farmerPhone || "").replace(/\s+/g, "");
                          return (
                            <div
                              key={c.id || i}
                              className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/30 transition-colors space-y-2 shadow-xs"
                            >
                              {/* Farmer Name, Region & Committed Quantity */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                                    <span>{c.farmerName}</span>
                                    {c.farmerRegion && (
                                      <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/40">
                                        📍 {c.farmerRegion}
                                      </span>
                                    )}
                                  </div>
                                  {c.createdAt && (
                                    <p className="text-[10px] text-muted-foreground">
                                      Committed on {new Date(c.createdAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs shrink-0 font-bold">
                                  {c.committedQuantity.toLocaleString()} {order.unit}
                                </Badge>
                              </div>

                              {/* Farmer Notes if provided */}
                              {c.notes && (
                                <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-1.5 rounded border border-border/30">
                                  "{c.notes}"
                                </p>
                              )}

                              {/* Direct Contact Actions: Call Farmer & WhatsApp */}
                              <div className="flex items-center gap-2 pt-1.5 border-t border-border/40 flex-wrap">
                                {cleanPhone ? (
                                  <>
                                    <a
                                      href={`tel:${cleanPhone}`}
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                                      title={`Call ${c.farmerName} directly: ${c.farmerPhone}`}
                                    >
                                      <Phone className="w-3 h-3" />
                                      <span>Call {c.farmerPhone}</span>
                                    </a>
                                    <a
                                      href={`https://wa.me/${cleanPhone.replace(/\+/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors"
                                      title="Chat on WhatsApp"
                                    >
                                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                                      <span>WhatsApp</span>
                                    </a>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <Phone className="w-3 h-3 text-muted-foreground/60" />
                                    <span>Verified Producer (Contact shared upon harvest)</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Bulk Order Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Create Wholesale Crop Demand
            </DialogTitle>
            <DialogDescription>
              Specify crop demand details and select your verified doorstep delivery destination.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Crop & Production Region */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Crop Name *</Label>
                <Input
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  placeholder="e.g. Cotton, Basmati Rice, Wheat"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Preferred Production Region *</Label>
                <Input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Guntur, Kurnool, Any Region"
                  required
                />
              </div>
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Required Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 5000"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Unit of Measurement *</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="quintal">Quintals (100 kg)</SelectItem>
                    <SelectItem value="ton">Metric Tons (1000 kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Expected Delivery Window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Expected Delivery Start *</Label>
                <Input
                  type="date"
                  min={todayStr}
                  value={deliveryStart}
                  onChange={(e) => setDeliveryStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Expected Delivery End *</Label>
                <Input
                  type="date"
                  min={deliveryStart || todayStr}
                  value={deliveryEnd}
                  onChange={(e) => setDeliveryEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Mandatory Delivery Address Selection with Map */}
            <div className="pt-2 border-t">
              <AddressSelector
                selectedAddressId={selectedAddress?.id}
                onSelect={(addr) => setSelectedAddress(addr)}
                title="Bulk Delivery Destination *"
              />
            </div>

            {/* Order Review Box */}
            {selectedAddress && (
              <div className="bg-muted/40 border rounded-lg p-3 text-xs space-y-1">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Delivery Destination Selected
                </span>
                <p className="text-muted-foreground">{selectedAddress.formattedAddress}</p>
                <p className="text-foreground/80 font-medium">Contact: {selectedAddress.recipientName} (+91 {selectedAddress.phone})</p>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !selectedAddress}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...
                  </>
                ) : (
                  "Create Bulk Order"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BulkOrders;
