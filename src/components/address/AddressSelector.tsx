import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MapPin,
  Plus,
  Home,
  Briefcase,
  Building2,
  CheckCircle2,
  Edit2,
  Trash2,
  Star,
  Loader2,
  Phone,
  Compass,
} from "lucide-react";
import LocationPickerMap, { GeocodedAddress } from "./LocationPickerMap";

export interface SavedAddress {
  id: string;
  _id?: string;
  recipientName: string;
  phone: string;
  houseNo: string;
  street: string;
  landmark?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  label: "Home" | "Work" | "Other";
  instructions?: string;
  isDefault: boolean;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress: string;
}

interface AddressSelectorProps {
  selectedAddressId?: string | null;
  onSelect?: (address: SavedAddress | null) => void;
  title?: string;
  compact?: boolean;
}

const PHONE_REGEX = /^(\+91[\-\s]?)?[6-9]\d{9}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const AddressSelector = ({
  selectedAddressId,
  onSelect = () => {},
  title = "Select Delivery Destination",
  compact = false,
}: AddressSelectorProps) => {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form Fields
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [label, setLabel] = useState<"Home" | "Work" | "Other">("Home");
  const [instructions, setInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; addresses: SavedAddress[] }>("/addresses");
      if (res && res.addresses) {
        setAddresses(res.addresses);

        // Auto-select logic
        if (res.addresses.length > 0) {
          if (!selectedAddressId) {
            const defaultAddr = res.addresses.find((a) => a.isDefault) || res.addresses[0];
            onSelect(defaultAddr);
          } else {
            const matched = res.addresses.find((a) => a.id === selectedAddressId);
            if (matched) onSelect(matched);
          }
        } else {
          onSelect(null);
        }
      }
    } catch (err) {
      console.warn("[AddressSelector] Failed to fetch saved addresses:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAddressId, onSelect]);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const openAddModal = () => {
    setEditingAddress(null);
    setRecipientName("");
    setPhone("");
    setHouseNo("");
    setStreet("");
    setLandmark("");
    setCity("");
    setDistrict("");
    setState("");
    setPincode("");
    setLabel("Home");
    setInstructions("");
    setIsDefault(addresses.length === 0);
    setCoords({ lat: null, lng: null });
    setShowModal(true);
  };

  const openEditModal = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setRecipientName(addr.recipientName || "");
    setPhone(addr.phone || "");
    setHouseNo(addr.houseNo || "");
    setStreet(addr.street || "");
    setLandmark(addr.landmark || "");
    setCity(addr.city || "");
    setDistrict(addr.district || "");
    setState(addr.state || "");
    setPincode(addr.pincode || "");
    setLabel(addr.label || "Home");
    setInstructions(addr.instructions || "");
    setIsDefault(addr.isDefault || false);
    setCoords({ lat: addr.latitude || null, lng: addr.longitude || null });
    setShowModal(true);
  };

  // Called when user pins a location or searches on the embedded map
  const handleMapLocationSelect = (geo: GeocodedAddress) => {
    setCoords({ lat: geo.lat, lng: geo.lng });
    if (geo.city && !city) setCity(geo.city);
    if (geo.district && !district) setDistrict(geo.district);
    if (geo.state && !state) setState(geo.state);
    if (geo.pincode && !pincode) setPincode(geo.pincode);
    if (geo.street && !street) setStreet(geo.street);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!recipientName.trim() || recipientName.trim().length < 2) {
      toast.error("Please enter recipient name (minimum 2 characters)");
      return;
    }

    if (!PHONE_REGEX.test(phone.trim())) {
      toast.error("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    if (!houseNo.trim()) {
      toast.error("Please enter flat / house / building details");
      return;
    }

    if (!street.trim()) {
      toast.error("Please enter street, locality, or village name");
      return;
    }

    if (!city.trim()) {
      toast.error("Please enter city or town");
      return;
    }

    if (!district.trim()) {
      toast.error("Please enter district");
      return;
    }

    if (!state.trim()) {
      toast.error("Please enter state");
      return;
    }

    if (!PINCODE_REGEX.test(pincode.trim())) {
      toast.error("Please enter a valid 6-digit Indian PIN code");
      return;
    }

    setSaving(true);
    const payload = {
      recipientName: recipientName.trim(),
      phone: phone.trim().replace(/^(\+91[\-\s]?)/, ""),
      houseNo: houseNo.trim(),
      street: street.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      district: district.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      label,
      instructions: instructions.trim(),
      isDefault,
      latitude: coords.lat,
      longitude: coords.lng,
    };

    try {
      if (editingAddress) {
        const res = await api.put<{ success: boolean; address: SavedAddress }>(
          `/addresses/${editingAddress.id}`,
          payload
        );
        if (res && res.address) {
          toast.success("Delivery address updated successfully!");
          setShowModal(false);
          await fetchAddresses();
          onSelect(res.address);
        }
      } else {
        const res = await api.post<{ success: boolean; address: SavedAddress }>(
          "/addresses",
          payload
        );
        if (res && res.address) {
          toast.success("New delivery address saved!");
          setShowModal(false);
          await fetchAddresses();
          onSelect(res.address);
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save address";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this delivery address?")) return;

    setDeletingId(id);
    try {
      await api.delete(`/addresses/${id}`);
      toast.success("Address removed");
      await fetchAddresses();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete address");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.put(`/addresses/${id}/default`);
      toast.success("Default address updated");
      await fetchAddresses();
    } catch (err: any) {
      toast.error(err.message || "Failed to update default address");
    }
  };

  const getLabelIcon = (type: string) => {
    switch (type) {
      case "Home":
        return <Home className="w-3.5 h-3.5 text-primary mr-1" />;
      case "Work":
        return <Briefcase className="w-3.5 h-3.5 text-blue-500 mr-1" />;
      default:
        return <Building2 className="w-3.5 h-3.5 text-amber-500 mr-1" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openAddModal}
          className="text-xs h-8 gap-1 border-primary/40 text-primary hover:bg-primary/5"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Address
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2 text-primary" />
          Loading saved addresses...
        </div>
      ) : addresses.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="py-6 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">No saved delivery address found</p>
            <p className="text-xs text-muted-foreground">
              Add your doorstep address with map pin to ensure reliable farm delivery.
            </p>
            <Button size="sm" onClick={openAddModal} className="mt-2">
              <Plus className="w-4 h-4 mr-1" /> Add Delivery Address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
          {addresses.map((addr) => {
            const isSelected = selectedAddressId === addr.id;

            return (
              <Card
                key={addr.id}
                onClick={() => onSelect(addr)}
                className={`cursor-pointer transition-all border ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40 bg-card"
                }`}
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="font-semibold text-sm text-foreground">
                        {addr.recipientName}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-0.5">
                        {getLabelIcon(addr.label)}
                        {addr.label}
                      </Badge>
                      {addr.isDefault && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-primary/15 text-primary border-0 font-medium">
                          DEFAULT
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {!addr.isDefault && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleSetDefault(e, addr.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(addr);
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === addr.id}
                        onClick={(e) => handleDeleteAddress(e, addr.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                    {addr.formattedAddress}
                  </p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pl-6 pt-1 border-t border-border/40">
                    <span className="flex items-center gap-1 text-foreground/80 font-medium">
                      <Phone className="w-3 h-3 text-muted-foreground" /> +91 {addr.phone}
                    </span>
                    {addr.latitude && addr.longitude ? (
                      <span className="flex items-center gap-1 text-primary text-[11px]">
                        <Compass className="w-3 h-3" /> GPS Pinned ({addr.latitude.toFixed(2)}, {addr.longitude.toFixed(2)})
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Manual Address</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Delivery Address Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) setShowModal(false); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              {editingAddress ? "Edit Delivery Address" : "Add New Delivery Address"}
            </DialogTitle>
            <DialogDescription>
              Pin your location on the map or type your address details below.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAddress} className="space-y-4">
            {/* Embedded Interactive Map */}
            <div>
              <Label className="text-xs font-semibold mb-1 block">
                Interactive Delivery Map (Pinpoint Entrance)
              </Label>
              <LocationPickerMap
                initialLat={coords.lat}
                initialLng={coords.lng}
                onLocationSelect={handleMapLocationSelect}
                height="190px"
              />
            </div>

            {/* Recipient & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Recipient Full Name *</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">10-Digit Mobile Number *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-medium">+91</span>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9876543210"
                    className="pl-11"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
            </div>

            {/* House & Street */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Flat / House No. / Building *</Label>
                <Input
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  placeholder="e.g. Flat 302, Green Valley Apartments"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Street / Locality / Village *</Label>
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. Gandhi Road, Near Market Yard"
                  required
                />
              </div>
            </div>

            {/* Landmark & PIN Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Landmark (Optional)</Label>
                <Input
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Opposite Water Tank"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">6-Digit PIN Code *</Label>
                <Input
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="e.g. 520010"
                  maxLength={6}
                  required
                />
              </div>
            </div>

            {/* City, District, State */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">City / Town *</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">District *</Label>
                <Input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="District"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State *</Label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  required
                />
              </div>
            </div>

            {/* Address Label Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Address Type</Label>
              <div className="flex gap-2">
                {(["Home", "Work", "Other"] as const).map((l) => (
                  <Button
                    key={l}
                    type="button"
                    variant={label === l ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs h-8"
                    onClick={() => setLabel(l)}
                  >
                    {getLabelIcon(l)}
                    {l}
                  </Button>
                ))}
              </div>
            </div>

            {/* Delivery Instructions & Default Toggle */}
            <div className="space-y-2 pt-1 border-t">
              <Input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Optional instructions (e.g. Call before delivery, drop at gate)"
                className="text-xs"
              />
              <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                Make this my default delivery address
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Address"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddressSelector;
