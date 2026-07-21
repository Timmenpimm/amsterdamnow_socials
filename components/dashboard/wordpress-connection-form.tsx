"use client";

import { useState, type FormEvent } from "react";

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

export function WordPressConnectionForm() {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Wiring up to the WordPress connector lands in Phase 2.
    event.preventDefault();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WordPress-verbinding</CardTitle>
        <CardDescription>
          Koppel een WordPress-website om artikelen te kunnen importeren.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wp-url">Website-URL</Label>
            <Input
              id="wp-url"
              name="url"
              type="url"
              placeholder="https://voorbeeld.nl"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wp-username">Gebruikersnaam</Label>
            <Input
              id="wp-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wp-app-password">Applicatiewachtwoord</Label>
            <Input
              id="wp-app-password"
              name="appPassword"
              type="password"
              autoComplete="off"
              value={appPassword}
              onChange={(event) => setAppPassword(event.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled>
            Verbinden
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
