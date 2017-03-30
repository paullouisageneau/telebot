
charger_width = 19;

rotate([90, 0, 0]) union() {
    difference() {
        cube([charger_width, 5, 3.5], center = true);
        union() {
            translate([0, -1.25, -0.25]) cube([charger_width/2, 10, 3], center = true);
            translate([-charger_width/2, 0, 0]) cube([4, 10, 10], center = true);
        }
    }
    translate([0, -1.25, 3.25]) cube([charger_width/2, 2.5, 3], center = true);
}