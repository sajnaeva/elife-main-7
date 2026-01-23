import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Countries list (common ones first, then alphabetical)
const COUNTRIES = [
  'India',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Oman',
  'Bahrain',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Singapore',
  'Malaysia',
];

// Kerala Districts
const KERALA_DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
  'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram',
  'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'
];

// Malappuram Panchayaths (complete list with Malayalam names)
const MALAPPURAM_PANCHAYATHS = [
  'A.R.Nagar (എ.ആർ.നഗർ)', 'Alamkodu (ആലംകോട്)', 'Aliparambu (ആലിപ്പറമ്പ്)', 'Amarambalam (അമരമ്പലം)',
  'Anakkayam (ആനക്കയം)', 'Angadipuram (അങ്ങാടിപ്പുറം)', 'Areekkode (അരീക്കോട്)', 'Athavanadu (ആതവനാട്)',
  'Chaliyar (ചാലിയാർ)', 'Cheekkode (ചീക്കോട്)', 'Chelambra (ചേലമ്പ്ര)', 'Cheriyamundam (ചെറിയമുണ്ടം)',
  'Cherukavu (ചെറുകാവ്)', 'Chokkadu (ചോക്കാട്)', 'Chunkathara (ചുങ്കത്തറ)', 'Edakkara (എടക്കര)',
  'Edappal (എടപ്പാൾ)', 'Edappatta (എടപ്പറ്റ)', 'Edarikkode (എടരിക്കോട്)', 'Edavanna (എടവണ്ണ)',
  'Edayur (എടയൂർ)', 'Elamkulam (ഏലംകുളം)', 'Irimbiliyam (ഇരിമ്പിളിയം)', 'Kaladi (കാലടി)',
  'Kalikavu (കാളികാവ്)', 'Kalpakanchery (കൽപകഞ്ചേരി)', 'Kannamangalam (കണ്ണമംഗലം)', 'Karulai (കരുളായി)',
  'Karuvarakkund (കരുവാരക്കുണ്ട്)', 'Kavannoor (കെ അവണ്ണൂർ)', 'Keezhattur (കീഴാറ്റൂർ)', 'Keezhuparambu (കീഴുപറമ്പ്)',
  'Kodoor (കോഡൂർ)', 'Koottilangadi (കൂട്ടിലങ്ങാടി)', 'Kuruva (കുറുവ)', 'Kuttippuram (കുറ്റിപ്പുറം)',
  'Kuzhimanna (കുഴിമണ്ണ)', 'Makkaraparambu (മക്കരപറമ്പ്)', 'Mambad (മമ്പാട്)', 'Mangalam (മംഗളം)',
  'Mankada (മങ്കട)', 'Marakkara (മാറാക്കര)', 'Maranchery (മാറഞ്ചേരി)', 'Melattur (മേലാറ്റൂർ)',
  'Moonniyur (മൂണ്ണിയൂർ)', 'Moorkkanadu (മൂർക്കനാട്)', 'Morayur (മൊറയൂർ)', 'Muthedam (മുത്തേടം)',
  'Muthuvallur (മുതുവല്ലൂർ)', 'Nannambra (നന്നമ്പ്ര)', 'Nannamukku (നന്നംമുക്ക്)', 'Niramaruthur (നിറമരുതൂർ)',
  'Orakam (ഒരകം)', 'Othukkungal (ഒതുക്കുങ്ങൽ)', 'Ozhur (ഒഴൂർ)', 'Pallikkal (പള്ളിക്കൽ)',
  'Pandikkad (പാണ്ടിക്കാട്)', 'Parappur (പറപ്പൂർ)', 'Perumanna Klari (പെരുമണ്ണ ക്ലാരി)', 'Perumpadappu (പെരുമ്പടപ്പ്)',
  'Peruvallur (പെരുവള്ളൂർ)', 'Ponmala (പൊന്മള)', 'Ponmundam (പൊന്മുണ്ടം)', 'Porur (പോരൂർ)',
  'Pothukallu (പോത്തുകല്ല്)', 'Pukkottur (പുക്കോട്ടൂർ)', 'Pulamanthol (പുലാമന്തോൾ)', 'Pulikkal (പുളിക്കൽ)',
  'Pulpatta (പുൽപ്പറ്റ)', 'Purathur (പുറത്തൂർ)', 'Puzhakkatteeri (പുഴക്കാട്ടീരി)', 'Thalakkadu (തലക്കാട്)',
  'Thanalur (താനാളൂർ)', 'Thavannur (തവന്നൂർ)', 'Thazhakkode (താഴക്കോട്)', 'Thenhippalam (തേഞ്ഞിപ്പലം)',
  'Thennala (തെന്നല)', 'Thirunavaya (തിരുനാവായ)', 'Thiruvali (തിരുവാലി)', 'Thrikkalangodu (തൃക്കലങ്ങോട്)',
  'Thriprangode (തൃപ്രങ്ങോട്)', 'Thuvoor (തുവൂർ)', 'Urgantteeri (ഊർഗന്തീരി)', 'Valavannur (വളവന്നൂർ)',
  'Vallikkunnu (വള്ളിക്കുന്ന്)', 'Vattakkulam (വട്ടക്കുളം)', 'Vazhakkad (വാഴക്കാട്)', 'Vazhayaur (വാഴയൂർ)',
  'Vazhikkadavu (വഴിക്കടവ്)', 'Veliyankode (വെളിയങ്കോട്)', 'Vengara (വേങ്ങര)', 'Vettom (വെട്ടം)',
  'Vettathur (വെട്ടത്തൂർ)', 'Wandoor (വണ്ടൂർ)'
];

// Common panchayaths by district (for autocomplete suggestions)
const COMMON_PANCHAYATHS: Record<string, string[]> = {
  'Thiruvananthapuram': ['Nemom', 'Kazhakkoottam', 'Vattiyoorkavu', 'Sreekaryam', 'Pallipuram', 'Venganoor'],
  'Kollam': ['Chavara', 'Karunagappally', 'Oachira', 'Punalur', 'Kundara', 'Paravur'],
  'Pathanamthitta': ['Thiruvalla', 'Adoor', 'Pandalam', 'Ranni', 'Kozhencherry'],
  'Alappuzha': ['Cherthala', 'Kayamkulam', 'Haripad', 'Mavelikara', 'Ambalapuzha'],
  'Kottayam': ['Changanassery', 'Pala', 'Vaikom', 'Ettumanoor', 'Erattupetta'],
  'Idukki': ['Thodupuzha', 'Adimali', 'Kattappana', 'Munnar', 'Nedumkandam'],
  'Ernakulam': ['Aluva', 'Angamaly', 'Perumbavoor', 'Muvattupuzha', 'Kothamangalam', 'Kakkanad'],
  'Thrissur': ['Kodungallur', 'Chalakudy', 'Irinjalakuda', 'Kunnamkulam', 'Guruvayur'],
  'Palakkad': ['Ottapalam', 'Chittur', 'Mannarkkad', 'Pattambi', 'Shoranur'],
  'Malappuram': MALAPPURAM_PANCHAYATHS,
  'Kozhikode': ['Vatakara', 'Koyilandy', 'Feroke', 'Ramanattukara', 'Mukkom'],
  'Wayanad': ['Kalpetta', 'Sulthan Bathery', 'Mananthavady', 'Panamaram'],
  'Kannur': ['Thalassery', 'Kannur', 'Payyanur', 'Taliparamba', 'Iritty'],
  'Kasaragod': ['Kanhangad', 'Nileshwaram', 'Manjeshwaram', 'Uppala', 'Cheruvathur']
};

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function PanchayathLocationPicker({ value, onChange }: LocationPickerProps) {
  const [country, setCountry] = useState('India');
  const [district, setDistrict] = useState('Malappuram');
  const [panchayath, setPanchayath] = useState('');
  const [place, setPlace] = useState('');
  const [useCustomInput, setUseCustomInput] = useState(false);

  // Parse existing location value - only run once on mount
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (!value || hasInitialized.current) return;
    hasInitialized.current = true;

    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) return;

    // Prefer detecting country by matching known countries to avoid "India, India" duplication
    const last = parts[parts.length - 1];
    const hasExplicitCountry = COUNTRIES.includes(last);

    const nextCountry = hasExplicitCountry ? last : 'India';
    const remaining = hasExplicitCountry ? parts.slice(0, -1) : parts;

    // Check if any part matches a district to properly identify it
    const districtIndex = remaining.findIndex(p => KERALA_DISTRICTS.includes(p));
    
    if (districtIndex !== -1) {
      // We found a district, parse accordingly
      setDistrict(remaining[districtIndex]);
      // Everything before district is place/panchayath
      if (districtIndex >= 2) {
        setPlace(remaining[0] || '');
        const parsedPanchayath = remaining.slice(1, districtIndex).join(', ') || '';
        setPanchayath(parsedPanchayath);
        // Check if panchayath is in suggestions list
        const suggestions = COMMON_PANCHAYATHS[remaining[districtIndex]] || [];
        if (parsedPanchayath && !suggestions.includes(parsedPanchayath)) {
          setUseCustomInput(true);
        }
      } else if (districtIndex === 1) {
        setPlace(remaining[0] || '');
        setPanchayath('');
      } else {
        setPlace('');
        setPanchayath('');
      }
    } else {
      // No district found, use positional parsing
      setPlace(remaining[0] || '');
      setPanchayath(remaining[1] || '');
      setDistrict(remaining[2] || '');
    }
    setCountry(nextCountry);
  }, [value]);

  // Update parent when location changes - use ref to prevent initial call
  const initialRender = useRef(true);
  
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    const locationParts = [place, panchayath, district, country].filter(Boolean);
    onChange(locationParts.join(', '));
  }, [country, district, panchayath, place, onChange]);

  // Get suggestions for panchayath based on selected district
  const panchayathSuggestions = district ? COMMON_PANCHAYATHS[district] || [] : [];
  
  // Determine if we should show dropdown or input
  const showDropdown = panchayathSuggestions.length > 0 && !useCustomInput;

  return (
    <div className="space-y-4">
      {/* Country */}
      <div className="space-y-2">
        <Label>Country</Label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District - Only show for India */}
      {country === 'India' && (
        <div className="space-y-2">
          <Label>District</Label>
          <Select value={district} onValueChange={(val) => {
            setDistrict(val);
            setPanchayath(''); // Reset panchayath when district changes
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select district" />
            </SelectTrigger>
            <SelectContent>
              {KERALA_DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Panchayath - Show select if suggestions available, otherwise text input */}
      <div className="space-y-2">
        <Label>Panchayath / Municipality</Label>
        {panchayathSuggestions.length > 0 ? (
          <div className="space-y-2">
            {showDropdown ? (
              <>
                <Select value={panchayath} onValueChange={setPanchayath}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select panchayath" />
                  </SelectTrigger>
                  <SelectContent>
                    {panchayathSuggestions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Not in list?{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setUseCustomInput(true);
                      setPanchayath('');
                    }}
                  >
                    Type manually
                  </button>
                </p>
              </>
            ) : (
              <>
                <Input
                  placeholder="Type panchayath name"
                  value={panchayath}
                  onChange={(e) => setPanchayath(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setUseCustomInput(false);
                      setPanchayath('');
                    }}
                  >
                    Select from list
                  </button>
                </p>
              </>
            )}
          </div>
        ) : (
          <Input
            placeholder="Enter your panchayath / municipality"
            value={panchayath}
            onChange={(e) => setPanchayath(e.target.value)}
          />
        )}
      </div>

      {/* Place */}
      <div className="space-y-2">
        <Label>Place / Area</Label>
        <Input
          placeholder="Enter your place or area name"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Your specific locality or area name
        </p>
      </div>

      {/* Location Preview */}
      {(place || panchayath || district || country) && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm font-medium text-foreground">Your Location:</p>
          <p className="text-sm text-muted-foreground">
            {[place, panchayath, district, country].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
