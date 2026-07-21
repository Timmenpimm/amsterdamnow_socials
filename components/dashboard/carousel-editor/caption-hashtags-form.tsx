"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CaptionHashtagsFormProps {
  caption: string;
  hashtags: string[];
  isSaving: boolean;
  onSave: (caption: string, hashtags: string[]) => Promise<boolean>;
}

/** Parses a comma-separated hashtag field into a clean, "#"-free string array. */
function parseHashtags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter((tag) => tag.length > 0);
}

/**
 * Caption + hashtags editor. Hashtags are edited as one comma-separated
 * field (consistent with the rest of this app's plain-Input form patterns —
 * there's no dedicated tag-input component) and previewed as badges below.
 */
export function CaptionHashtagsForm({
  caption,
  hashtags,
  isSaving,
  onSave,
}: CaptionHashtagsFormProps) {
  const [captionValue, setCaptionValue] = useState(caption);
  const [hashtagsValue, setHashtagsValue] = useState(hashtags.join(", "));

  // Reset the form whenever the canonical caption/hashtags change (initial
  // load or a successful save) — adjusting state during render per
  // https://react.dev/learn/you-might-not-need-an-effect, rather than in a
  // useEffect that would cause an extra render.
  const signature = `${caption}:${hashtags.join(",")}`;
  const [prevSignature, setPrevSignature] = useState(signature);
  if (prevSignature !== signature) {
    setPrevSignature(signature);
    setCaptionValue(caption);
    setHashtagsValue(hashtags.join(", "));
  }

  const previewTags = parseHashtags(hashtagsValue);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onderschrift &amp; hashtags</CardTitle>
        <CardDescription>
          De Instagram-caption en hashtags die met deze carousel worden gepubliceerd.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="carousel-caption">Onderschrift</Label>
          <Textarea
            id="carousel-caption"
            value={captionValue}
            onChange={(event) => setCaptionValue(event.target.value)}
            disabled={isSaving}
            rows={5}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="carousel-hashtags">Hashtags (komma-gescheiden)</Label>
          <Input
            id="carousel-hashtags"
            value={hashtagsValue}
            onChange={(event) => setHashtagsValue(event.target.value)}
            disabled={isSaving}
            placeholder="amsterdam, uitgaan, cultuur"
          />
          {previewTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {previewTags.map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onSave(captionValue.trim(), parseHashtags(hashtagsValue))}
          disabled={isSaving || captionValue.trim().length === 0}
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          Opslaan
        </Button>
      </CardFooter>
    </Card>
  );
}
