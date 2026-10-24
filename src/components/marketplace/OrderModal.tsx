import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddressSelector, SavedAddress } from "@/components/address/AddressSelector";
import { ShoppingBag, Truck, IndianRupee, MapPin } from "lucide-react";
import type { MarketCrop } from "./CropCard";

interface OrderModalProps {
  item: MarketCrop | null;
  mode: "buy" | "bulk";
  userId: string | undefined;
  onClose: () => void;
}

const OrderModal = ({ item, mode, userId, onClose }: OrderModalProps) => {
  const [qty, setQty] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!item) return null;

  const qtyNum = parseFloat(qty);
  const total = qtyNum > 0 ? qtyNum * item.expected_price : 0;

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("Please log in first to place an order");
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      toast.error("Enter a valid quantity greater than zero");
      return;
    }

    if (mode === "buy" && !selectedAddress) {
      toast.error("Please select or add a delivery address to proceed");
      return;
    }

    setSubmitting(true);

    if (mode === "buy") {
      try {
        const payload = {
          productId: item.id || item.farmer_id,
          quantity: qtyNum,
          addressId: selectedAddress?.id,
          deliveryAddress: selectedAddress?.formattedAddress,
          deliveryAddressSnapshot: selectedAddress
            ? {
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
              }
            : undefined,
        };

        const res = await api.post<any>("/orders", payload);

        if (res && (res.success || res.order)) {
          toast.success(
            `Order #${res.order?.orderNumber || ""} placed successfully for ${qtyNum} kg of ${item.crop_name}!`,
            { duration: 6000 }
          );
          onClose();
        } else {
          toast.error(res?.message || "Failed to place order");
        }
      } catch (err: any) {
        console.error("[OrderModal] Error placing order:", err);
        const msg = err.response?.data?.message || err.message || "Failed to place order";
        toast.error(msg);
      }
    } else {
      // Bulk request
      try {
        const { error } = await supabase.from("bulk_requests").insert({
          consumer_id: userId,
          farmer_id: item.farmer_id,
          crop_id: item.id || item.farmer_id,
          quantity: qtyNum,
          status: "pending",
        });
        if (error) {
          toast.error("Failed: " + error.message);
        } else {
          toast.success(`Bulk request sent for ${qtyNum} kg!`);
          onClose();
        }
      } catch (e: any) {
        toast.error("Bulk request error: " + e.message);
      }
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="w-5 h-5 text-primary" />
            {mode === "buy" ? "Express Produce Checkout" : "Bulk Order Request"} — {item.crop_name}
          </DialogTitle>
          <DialogDescription>
            {mode === "buy"
              ? "Review crop price, select your verified delivery address, and confirm."
              : "Send custom bulk requirement to farmer."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crop & Pricing Overview Card */}
          <div className="bg-muted/40 border rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground block">Farmer</span>
              <span className="font-semibold text-foreground text-sm truncate block">{item.farmer_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Unit Price</span>
              <span className="font-semibold text-foreground text-sm block">₹{item.expected_price}/kg</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Available Stock</span>
              <span className="font-semibold text-foreground text-sm block">{item.total_yield} kg</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Farming Type</span>
              <span className="font-semibold text-foreground text-sm block">{item.farming_type}</span>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Enter Quantity (in Kilograms) *</Label>
            <Input
              type="number"
              min="1"
              max={item.total_yield}
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={`Enter kg (1 to ${item.total_yield})`}
              className="text-sm font-medium"
            />
          </div>

          {/* Mandatory Delivery Address System */}
          {mode === "buy" && (
            <div className="pt-2 border-t">
              <AddressSelector
                selectedAddressId={selectedAddress?.id}
                onSelect={(addr) => setSelectedAddress(addr)}
                title="Delivery Address *"
              />
            </div>
          )}

          {/* Total & Summary Section */}
          {total > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5 text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Subtotal ({qty} kg)</span>
                <span className="font-semibold text-foreground">₹{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Delivery & Handling</span>
                <span className="text-primary font-medium text-xs">FREE Farm-to-Door</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-primary/20 text-base font-bold">
                <span className="text-foreground">Total Payable</span>
                <span className="text-primary flex items-center">
                  <IndianRupee className="w-4 h-4 mr-0.5" />
                  {total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs pt-1">
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-primary" /> Payment Method: Cash on Delivery (COD)
                </span>
                <span>Est. Delivery: 2-4 business days</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (mode === "buy" && !selectedAddress) || !qtyNum || qtyNum <= 0}
            className="gap-1.5"
          >
            {submitting ? "Processing Order..." : `Confirm Order (₹${total.toFixed(2)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderModal;
