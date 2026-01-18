import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Gift, Play, X } from 'lucide-react';
import { useState } from 'react';
import { YouTubeEmbed } from './YouTubeEmbed';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

interface PromotionalContent {
  id: string;
  title: string;
  description: string | null;
  content_type: 'banner' | 'poster' | 'image' | 'video' | 'offer';
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  link_text: string | null;
}

export function PromotionalBanner() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotional-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotional_content')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as PromotionalContent[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading || !promotions || promotions.length === 0) return null;

  const visiblePromotions = promotions.filter(p => !dismissedIds.has(p.id));
  
  if (visiblePromotions.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  // If only one promotion, show it directly
  if (visiblePromotions.length === 1) {
    return <SinglePromotion item={visiblePromotions[0]} onDismiss={handleDismiss} />;
  }

  // Multiple promotions - show carousel
  return (
    <Carousel className="w-full">
      <CarouselContent>
        {visiblePromotions.map((item) => (
          <CarouselItem key={item.id}>
            <SinglePromotion item={item} onDismiss={handleDismiss} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2" />
      <CarouselNext className="right-2" />
    </Carousel>
  );
}

function SinglePromotion({ 
  item, 
  onDismiss 
}: { 
  item: PromotionalContent; 
  onDismiss: (id: string) => void;
}) {
  const [showVideo, setShowVideo] = useState(false);

  const getContentTypeStyles = () => {
    switch (item.content_type) {
      case 'offer':
        return 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30';
      case 'banner':
        return 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30';
      case 'video':
        return 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30';
      default:
        return 'border-border';
    }
  };

  return (
    <Card className={`relative overflow-hidden ${getContentTypeStyles()} shadow-soft`}>
      <button
        onClick={() => onDismiss(item.id)}
        className="absolute top-2 right-2 z-10 p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      {item.content_type === 'offer' && (
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-amber-500 text-white gap-1">
            <Gift className="h-3 w-3" />
            Special Offer
          </Badge>
        </div>
      )}

      {item.image_url && !showVideo && (
        <div className="relative">
          <img 
            src={item.image_url} 
            alt={item.title}
            className="w-full h-40 sm:h-52 object-cover"
          />
          {item.video_url && (
            <button
              onClick={() => setShowVideo(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
            >
              <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="h-6 w-6 text-primary fill-primary ml-1" />
              </div>
            </button>
          )}
        </div>
      )}

      {showVideo && item.video_url && (
        <div className="relative">
          <YouTubeEmbed url={item.video_url} />
          <button
            onClick={() => setShowVideo(false)}
            className="absolute top-2 left-2 z-10 p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <CardContent className={`p-4 ${item.image_url ? '' : 'pt-10'}`}>
        <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
        {item.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {item.description}
          </p>
        )}
        
        <div className="flex items-center gap-2">
          {item.link_url && (
            <Button 
              size="sm" 
              className="gap-1"
              onClick={() => window.open(item.link_url!, '_blank')}
            >
              {item.link_text || 'Learn More'}
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
          {item.video_url && !showVideo && !item.image_url && (
            <Button 
              size="sm" 
              variant="outline"
              className="gap-1"
              onClick={() => setShowVideo(true)}
            >
              <Play className="h-3 w-3" />
              Watch Video
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
