import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, Loader2 } from 'lucide-react';
import { PanchayathLocationPicker } from '@/components/settings/PanchayathLocationPicker';

interface LocationPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSet?: () => void;
}

export function LocationPopup({ open, onOpenChange, onLocationSet }: LocationPopupProps) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState('');
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support location services',
        variant: 'destructive',
      });
      return;
    }

    setFetchingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          );
          const data = await response.json();

          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.state;
          const country = data.address?.country;

          const locationString = [city, country].filter(Boolean).join(', ');
          setLocation(locationString || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch (error) {
          console.error('Error getting location:', error);
          toast({
            title: 'Error getting location',
            description: 'Please enter your location manually',
            variant: 'destructive',
          });
        } finally {
          setFetchingLocation(false);
        }
      },
      (error) => {
        setFetchingLocation(false);
        let message = 'Unable to get your location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Please allow location access in your browser settings';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }

        toast({ title: 'Location error', description: message, variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSave = async () => {
    if (!user || !location.trim()) {
      toast({ title: 'Please enter or detect your location', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ location: location.trim() })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast({ title: 'Location saved!', description: `Your location: ${location}` });
      onLocationSet?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: 'Error saving location',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Set Your Location
          </DialogTitle>
          <DialogDescription>
            Share your location to find nearby friends, communities, and businesses
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">

          {/* Manual location picker */}
          <div className="space-y-2">
            <Label>Your Location (Panchayath/Municipality)</Label>
            <PanchayathLocationPicker value={location} onChange={setLocation} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 gradient-primary text-white"
              onClick={handleSave}
              disabled={saving || !location.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Location'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
