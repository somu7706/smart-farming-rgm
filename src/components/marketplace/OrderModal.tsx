import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MarketCrop } from "./CropCard";

interface OrderModalProps {
  item: MarketCrop | null;
  mode: "buy" | "bulk";
  userId: string | undefined;
  onClose: () => void;
}

const OrderModal = ({ item, mode, userId, onClose }: OrderModalProps) => {
  const [qty, setQty] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
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

    setSubmitting(true);

    if (mode === "buy") {
      try {
        const payload = {
          productId: item.id || item.farmer_id,
          quantity: qtyNum,
          deliveryAddress: deliveryAddress.trim() || undefined,
        };

        const res = await api.post<any>("/orders", payload);

        if (res && (res.success || res.order)) {
          toast.success(`Order placed successfully for ${qtyNum} kg of ${item.crop_name}!`, {
            duration: 5000,
          });
          onClose();
        } else {
          toast.error(res?.message || "Failed to place order");
        }
      } catch (err: any) {
        console.error("[OrderModal] Error placing order:", err);
        // If API error has message, show it
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "buy" ? "Buy Produce" : "Bulk Order"} — {item.crop_name}</DialogTitle>
          <DialogDescription>
            {mode === "buy" ? "Order directly from the verified farmer." : "Send custom bulk requirement to farmer."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Farmer: <span className="text-foreground font-medium">{item.farmer_name}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Price: <span className="text-foreground font-medium">₹{item.expected_price}/kg</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Available: <span className="text-foreground font-medium">{item.total_yield} kg</span>
          </div>
          <div className="space-y-2">
            <Label>Quantity (kg)</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>
          {mode === "buy" && (
            <div className="space-y-2">
              <Label>Delivery Address (Optional)</Label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter doorstep delivery address"
              />
            </div>
          )}
          {total > 0 && (
            <div className="bg-muted rounded-md p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Total Price</span>
                <span className="font-bold text-foreground">₹{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Payment</span>
                <span>Cash on Delivery (COD)</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Est. Delivery</span>
                <span>2-4 business days</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Processing..." : "Confirm Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderModal;
