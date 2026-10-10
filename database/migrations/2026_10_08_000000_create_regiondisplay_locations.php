<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ext_regiondisplay_locations', function (Blueprint $table): void {
            $table->unsignedInteger('location_id')->primary();
            $table->char('country_code', 2);
            $table->string('display_name', 64)->nullable();
            $table->timestamps();
            $table->foreign('location_id')->references('id')->on('locations')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ext_regiondisplay_locations');
    }
};
