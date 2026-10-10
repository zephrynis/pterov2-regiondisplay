<?php

use Illuminate\Support\Facades\Route;
use RegionDisplay\Http\RegionController;

Route::post('/regions', [RegionController::class, 'servers']);
