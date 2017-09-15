function main() {

  let modelWidth = 10;

  let outerWallThickness = 1;

  let separation = 0.;
  //let separation = .3;
  //let separation = 1.5;
  //let separation = -3;


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
    console.log("len2 = "+len2);
    let len = Math.sqrt(len2);
    let point = [offset*normal[0]/len, offset*normal[1]/len, offset*normal[2]/len];
    console.log("HEY! point was "+point);
    point[0] += dx;
    point[1] += dy;
    point[2] += dz;
    console.log("HEY! point is "+point);
    let answer = [normal, normal[0]*point[0] + normal[1]*point[1] + normal[2]*point[2]];
    console.log("HEY! "+[normal,offset]+" ->"+[dx,dy,dz]+"-> "+answer);
    return answer;
  };
  let scalePlane = function([normal,offset], s) {
    return [normal, offset*s];
  };


  if (false) {
    let cube = CSG.roundedCube({radius: 10, roundradius: 2, resolution: 16});
    let sphere = CSG.sphere({radius: 10, resolution: 16}).translate([5, 5, 5]);
    return cube.union(sphere);
  } else {

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
    console.log("planes = "+planes);


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

    for (let i = 0; i < planes.length; ++i) {
      planes[i] = scalePlane(planes[i], scale);
    }

    let knife = CSG.cube({radius: 2*scale});
    for (let planeSpec of planes) {
      let normal = planeSpec[0];
      let offset = planeSpec[1];

      if (normal[0]>0 && normal[1]>0 && normal[2]>0) continue;

      offset -= outerWallThickness;
      var plane = CSG.Plane.fromNormalAndPoint(normal, [offset*normal[0], offset*normal[1], offset*normal[2]]);
      knife = knife.cutByPlane(plane);
    }
    clay = clay.subtract(knife);

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
}
