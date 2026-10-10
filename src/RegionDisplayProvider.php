<?php

declare(strict_types=1);

namespace RegionDisplay;

use Pterodactyl\Extensions\ExtensionProvider;

final class RegionDisplayProvider extends ExtensionProvider
{
    public function boot(): void
    {
        $this->registerApiRoutes();
        $this->loadExtensionMigrations();
    }
}
