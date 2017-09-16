function main() {

  let CHECK = function(cond) {
    if (cond !== true) {
      throw new Error("CHECK failed");
    }
  };

  // modelWidth=20, thickWallThickness=3, separation=1 or 3 or 10 -> $3.34 for one piece, $26.73 for 8 pieces, $15.04 if all fused together as 1 piece

  // Melinda's width is 17.52 mm (in some early model)
  let modelWidth = 20;

  let separation = 0.;
  //let separation = 3;
  //let separation = -.0001;
  //let separation = 1.5;
  //let separation = -3;

  let doPreRound = true;
  let preRoundRadius = .75;
  //let preRoundRes = 20;
  let preRoundRes = 40; // looks better but takes a while

  let thickWallThickness = 2;


  let dimpleRadius = .5;
  let dimpleDiskRadiusDegrees = 60.;
  let dimpleSphereRadius = dimpleRadius / Math.sin(dimpleDiskRadiusDegrees/180.*Math.PI);

  //let thinWallThickness = .7;  // .7 is minimum allowed
  let thinWallThickness = .675;  // .7 is minimum allowed

  let cylinderDiameter = 4;
  let cylinderResolution = 40;


  let showMagnetsOnly = false;
  let swissCheese = false;  // set to true to force thinWallThickness to 0


  // Note, scaleFudge other than 1 doesn't really work since the placements of dimples/pimples/cyls is still in the original space
  let scaleFudge = 1.;
  {
    modelWidth *= scaleFudge;
    separation *= scaleFudge;
    preRoundRadius *= scaleFudge;
    thickWallThickness *= scaleFudge;
    dimpleRadius *= scaleFudge;
    dimpleSphereRadius *= scaleFudge;
    thinWallThickness *= scaleFudge;
    cylinderDiameter *= scaleFudge;
  }

  //==================================================

  if (swissCheese) {
    thinWallThickness = 0.;
  }


  let vpv = (v0,v1) => {
    let answer = [];
    for (let i = 0; i < v0.length; ++i) {
      answer.push(v0[i] + v1[i]);
    }
    return answer;
  };
  let vmv = (v0,v1) => {
    let answer = [];
    for (let i = 0; i < v0.length; ++i) {
      answer.push(v0[i] - v1[i]);
    }
    return answer;
  };
  let sxv = (s,v) => {
    let answer = [];
    for (let x of v) { answer.push(s * x); }
    return answer;
  };
  let dot = (v0,v1) => {
    let answer = 0.;
    for (let i = 0; i < v0.length; ++i) {
      answer += v0[i] * v1[i];
    }
    return answer;
  };
  let len2 = v => dot(v,v);
  let len = v => Math.sqrt(len2(v));
  let normalized = v => sxv(len(v), v);

  //
  // Probably ill-advised geometry / vector math functions...
  //
  let rotateX = function([normal,offset], degrees) {
    let s = Math.sin(degrees/180*Math.PI);
    let c = Math.cos(degrees/180*Math.PI);
    return [[normal[0], normal[1]*c - normal[2]*s, normal[1]*s + normal[2]*c], offset];
  };
  let rotateY = function([normal,offset], degrees) {
    let s = Math.sin(degrees/180*Math.PI);
    let c = Math.cos(degrees/180*Math.PI);
    return [[normal[2]*s + normal[0]*c, normal[1], normal[2]*c - normal[0]*s], offset];
  };
  let rotateZ = function([normal,offset], degrees) {
    let s = Math.sin(degrees/180*Math.PI);
    let c = Math.cos(degrees/180*Math.PI);
    return [[normal[0]*c - normal[1]*s, normal[0]*s + normal[1]*c, normal[2]], offset];
  };
  let translatePlane = function([normal,offset], [dx,dy,dz]) {
    let len2 = normal[0]**2 + normal[1]**2 + normal[2]**2;

    let len = Math.sqrt(len2);
    let point = [offset*normal[0]/len, offset*normal[1]/len, offset*normal[2]/len];
    point[0] += dx;
    point[1] += dy;
    point[2] += dz;
    let answer = [normal, normal[0]*point[0] + normal[1]*point[1] + normal[2]*point[2]];
    return answer;
  };
  let scalePlane = function([normal,offset], s) {
    return [normal, offset*s];
  };

  let rotateCSGtakingUnitVectorToUnitVector = (csg, from, to) => {
    // only works when from is z axis.
    CHECK(from[0] == 0);
    CHECK(from[1] == 0);
    CHECK(from[2] == 1);
    if (to[0] == 0 && to[1] == 0) {
      return to[2] >= 0 ? csg : csg.rotateX(180);
    }
    // XXX TODO: should use parallel transport math (2 householder reflections) instead of this
    let lat = Math.atan2(to[2], Math.hypot(to[0], to[1]));
    let lng = Math.atan2(to[1], to[0]);
    csg = csg.rotateY(90. - lat/Math.PI*180);  // Z axis towards X axis
    csg = csg.rotateZ(lng/Math.PI*180);  // X axis towards Y axis
    return csg;
  };

  let makeCylinderTheWayIThoughtItWasSupposedToWork = params => {
    if (false) {
      return CSG.cylinder(params);
    }
    // didn't have any luck with rotated start,end (produces weird shearing),
    // so start with axis aligned and...
    let start = params.start;
    let end = params.end;
    let cyl = CSG.cylinder({
      start: [0,0,0],
      end: [0,0,1],
      radius: cylinderDiameter/2.,
      resolution: cylinderResolution,
    });
    cyl = cyl.scale([1,1,len(vmv(end, start))]);
    let dir = normalized(vmv(end, start));
    cyl = rotateCSGtakingUnitVectorToUnitVector(cyl, [0,0,1], dir);
    cyl = cyl.translate(start);
    return cyl;
  };  // makeCylinderTheWayIThoughtItWasSupposedToWork


  // Start with 1/3 of the planes of the outer polyhedron...
  let planes = [
      [[0.3333333333333333,0.6666666666666667,0.6666666666666667],1.], // corner
      [[0.5773502691896258,0.5773502691896258,0.5773502691896258],0.8909765116357686], // face
      [[0.5,0.5,0.7071067811865475],0.9667811436055143], // frontishEdge
      [[0.5,0.7071067811865475,0.5],0.9667811436055143], // toppishEdge
      //[[-0.7071067811865475,0,-0.7071067811865475],0], // backLeftBounding
      //[[-0.7071067811865475,-0.7071067811865475,0],0], // downLeftBounding
      [[0.7071067811865475,0,-0.7071067811865475],0], // backRightBounding
      //[[0.7071067811865475,-0.7071067811865475,0],0], // downRightBounding
  ];

  // Rotate, to form all the planes of the outer polyhedron...
  if (true)
  {
    let n = planes.length;
    for (let i = 0; i < 2*n; ++i) {
      let plane = planes[i];
      let normal = plane[0];
      let offset = plane[1];
      // rotate z -> y -> -x
      //planes.push([[-normal[1],normal[2],normal[0]], offset]);
      // no, it's this instead.  I have no idea why.
      planes.push([[-normal[1],normal[2],-normal[0]], offset]);
    }
  }

  // its right corner is pointed at -1,1,1.  re-point it at 1,1,1.
  for (let plane of planes) {
    plane[0] = [plane[0][1], -plane[0][0], plane[0][2]];
  }
  console.log("planes.length = "+planes.length);
  //console.log("planes = "+planes);


  if (true) {
    // Try to get the three primary faces axis aligned at the origin
    for (let i = 0; i < planes.length; ++i) {
      let plane = planes[i];

      plane = rotateZ(plane, 45);
      plane = rotateX(plane, -Math.atan2(1,Math.sqrt(2))/Math.PI*180);
      plane = rotateY(plane, 60);
      plane = rotateX(plane, Math.atan2(1,Math.sqrt(2))/Math.PI*180);
      plane = rotateZ(plane, -45);
      plane = translatePlane(plane, [-1,-1,-1]);
      plane = rotateZ(plane, 180);
      plane = rotateX(plane, 90);

      // Fudge so first set of stuff is roughly on xy plane,
      // since that's what I assume when making cylinders
      plane = rotateY(plane, -90);
      plane = rotateZ(plane, -90);

      planes[i] = plane;
    }
  }

  let clay = CSG.cube({radius: 10});
  for (let planeSpec of planes) {
    let normal = planeSpec[0];
    let offset = planeSpec[1];
    //let plane = new CSG.Plane(normal, offset);
    var plane = CSG.Plane.fromNormalAndPoint(normal, [offset*normal[0], offset*normal[1], offset*normal[2]]);
    clay = clay.cutByPlane(plane);
  }


  // Figure out bounding box
  if (false) {
    console.log("clay.getBounds() = "+clay.getBounds());
    console.log("clay.getBounds()[0] = "+clay.getBounds()[0]);
    console.log("clay.getBounds()[1] = "+clay.getBounds()[1]);
    console.log("clay.getBounds()[0].x = "+clay.getBounds()[0].x);
    console.log("clay.getBounds()[0].y = "+clay.getBounds()[0].y);
    console.log("clay.getBounds()[0].z = "+clay.getBounds()[0].z);
    console.log("clay.getBounds()[1].x = "+clay.getBounds()[1].x);
    console.log("clay.getBounds()[1].y = "+clay.getBounds()[1].y);
    console.log("clay.getBounds()[1].z = "+clay.getBounds()[1].z);
  }

  let scale = modelWidth/(clay.getBounds()[1].y - clay.getBounds()[0].y);  // arbitrary one of the three
  console.log("scaling by "+scale+" to get modelWidth="+modelWidth);

  clay = clay.scale(scale);
  if (false) {
    console.log("clay.getBounds() = "+clay.getBounds());
    console.log("clay.getBounds()[0] = "+clay.getBounds()[0]);
    console.log("clay.getBounds()[1] = "+clay.getBounds()[1]);
    console.log("clay.getBounds()[0].x = "+clay.getBounds()[0].x);
    console.log("clay.getBounds()[0].y = "+clay.getBounds()[0].y);
    console.log("clay.getBounds()[0].z = "+clay.getBounds()[0].z);
    console.log("clay.getBounds()[1].x = "+clay.getBounds()[1].x);
    console.log("clay.getBounds()[1].y = "+clay.getBounds()[1].y);
    console.log("clay.getBounds()[1].z = "+clay.getBounds()[1].z);
  }

  // and scale the planes too, to be used in subsequent operations
  for (let i = 0; i < planes.length; ++i) {
    planes[i] = scalePlane(planes[i], scale);
  }

  if (doPreRound && preRoundRadius > 0.) {
    console.log("    starting pre-round");
    clay = clay.contract(preRoundRadius, preRoundRes);
    console.log("    halfway done with pre-round");
    clay = clay.expand(preRoundRadius, preRoundRes);
    console.log("    done with pre-round");
  }

  if (true) {
    // Try to place the dimples/pimples.
    let facePlane = planes[4];
    let [faceNormal,faceOffset] = facePlane;
    let elevationFudge = Math.cos(dimpleDiskRadiusDegrees/180.*Math.PI) * dimpleSphereRadius;
    console.log("elevationFudge = "+elevationFudge);
    let pimples = [];
    let dimples = [];
    {
      let center = [0,-2.25,3];
      // Adjust center so it's on the plane
      let delta = sxv(faceOffset - dot(faceNormal, center), faceNormal);
      center = vpv(center, delta);
      let sphere = CSG.sphere({
        radius: dimpleSphereRadius,
        center: center,
        resolution: 40,  // default is 12
      });
      pimples.push(sphere.translate(sxv(-elevationFudge, faceNormal)));
      sphere = sphere.mirrored(CSG.Plane.fromPoints([0,0,0],[1,0,0],[1,1,1]));
      dimples.push(sphere.translate(sxv(elevationFudge, faceNormal)));
    }
    {
      let center = [0,-1.1,10];
      // Adjust center so it's on the plane
      let delta = sxv(faceOffset - dot(faceNormal, center), faceNormal);
      center = vpv(center, delta);
      let sphere = CSG.sphere({
        radius: dimpleSphereRadius,
        center: center,
        resolution: 40,  // default is 12
      });
      pimples.push(sphere.translate(sxv(-elevationFudge, faceNormal)));
      sphere = sphere.mirrored(CSG.Plane.fromPoints([0,0,0],[1,0,0],[1,1,1]));
      dimples.push(sphere.translate(sxv(elevationFudge, faceNormal)));
    }
    // convert from array to single object
    pimples = pimples.reduce((a,b) => a.union(b));
    dimples = dimples.reduce((a,b) => a.union(b));

    if (true) {
      pimples = pimples.union(pimples.rotateZ(90).rotateY(90))
                       .union(pimples.rotateY(-90).rotateZ(-90));
      dimples = dimples.union(dimples.rotateZ(90).rotateY(90))
                       .union(dimples.rotateY(-90).rotateZ(-90));
    }

    clay = clay.union(pimples);
    clay = clay.subtract(dimples);
  }

  if (true) {
    let knife = CSG.cube({radius: 2*scale});
    for (let planeSpec of planes) {
      let normal = planeSpec[0];
      let offset = planeSpec[1];

      if (normal[0]>0 && normal[1]>0 && normal[2]>0) continue;

      offset -= thickWallThickness;
      var plane = CSG.Plane.fromNormalAndPoint(normal, [offset*normal[0], offset*normal[1], offset*normal[2]]);
      knife = knife.cutByPlane(plane);
    }
    clay = clay.subtract(knife);
  }


  if (true) {
    // Try to place cylindrical holes.
    let cyls = null;

    let cylHeight = thickWallThickness;

    {
      // one of the cylinders on corner face
      let x = 10.5;
      //let y = 4.5;
      let y = 5.5;
      let cyl = CSG.cylinder({
        start: [x,y,thinWallThickness],  // default start is [0,-1,0]
        end: [x,y,thinWallThickness+cylHeight], // default end is [0,1,0]
        radius: cylinderDiameter/2., // default radius is 1
        resolution: cylinderResolution, // default resolution is 32

        //center: true, // default: center:false   XXX doesn't seem to matter?
        center: [true,true,false], // default: center:false   XXX doesn't seem to matter-- always centers??
      });
      cyls = cyl;
    }

    {
      // 1 of the cylinders on "face" face
      let facePlane = planes[1];
      let [faceNormal,faceOffset] = facePlane;

      let start = [14.75, 11, 0];

      // Adjust start so it's on the plane
      let delta = sxv(faceOffset - dot(faceNormal, start), faceNormal);
      start = vpv(start, delta);
      // Adjust start by thinWallThickness
      start = vpv(start, sxv(-thinWallThickness, faceNormal));
      let end = vpv(start, sxv(-thickWallThickness, faceNormal));

      let cyl = makeCylinderTheWayIThoughtItWasSupposedToWork({
        start: start,
        end: end,
        radius: cylinderDiameter/2.,
        resolution: cylinderResolution,
      });

      cyls = cyls.union(cyl);
    }

    {
      // the cylinder on one of the "edge" faces
      let facePlane = planes[2];
      let [faceNormal,faceOffset] = facePlane;

      //let start = [5, 16.5, 0];
      //let start = [4.5, 16.675, 0];  // had this for a while, Melinda pointed out it won't have clearance
      //let start = [5.125, 16.675, 0];  // too close to edge! red
      //let start = [5.125, 16.5, 0];  // pretty good.  magnets might still be brushing though
      let start = [5.25, 16.5, 0];  // pretty good.  magnets might still be brushing though

      // Adjust start so it's on the plane
      let delta = sxv(faceOffset - dot(faceNormal, start), faceNormal);
      start = vpv(start, delta);
      // Adjust start by thinWallThickness
      start = vpv(start, sxv(-thinWallThickness, faceNormal));
      let end = vpv(start, sxv(-thickWallThickness, faceNormal));


      let cyl = makeCylinderTheWayIThoughtItWasSupposedToWork({
        start: start,
        end: end,
        radius: cylinderDiameter/2.,
        resolution: cylinderResolution,
      });

      cyls = cyls.union(cyl);
    }

    if (true) {
      cyls = cyls.union(cyls.mirrored(CSG.Plane.fromPoints([0,0,0],[1,1,0],[1,1,1])));
    }
    if (true) {
      cyls = cyls.union(cyls.rotateZ(90).rotateY(90))
                 .union(cyls.rotateY(-90).rotateZ(-90));
    }

    //clay = clay.union(cyls);
    clay = clay.subtract(cyls);
    //clay = cyls;

    if (showMagnetsOnly) {
      return cyls;
    }
  }

  clay = clay.translate([separation/2,separation/2,separation/2]);

  let answer = clay;
  if (false) {
    // Replicate 8 times
    answer = answer.union(answer.rotateZ(90));
    answer = answer.union(answer.rotateZ(180));
    answer = answer.union(answer.rotateX(180));
  }

  return answer;
}
